import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ulid } from "ulid";
import { env } from "../utils/env";
import { logger } from "../utils/logger";
import { ApiError } from "../utils/errors";
import { delay } from "../utils/timeout";
import {
  SHELL_EXECUTOR_CONTRACT_VERSION,
  shellExecutorJobRequestSchema,
  shellExecutorJobResultSchema,
  type ShellExecutorJobResult,
} from "./shellExecutorContract";

const ecsClient = new ECSClient({ region: env.awsRegion });
const s3Client = new S3Client({ region: env.awsRegion });

async function readBodyAsString(body: any): Promise<string> {
  if (!body) return "";
  if (typeof body === "string") return body;
  if (Buffer.isBuffer(body)) return body.toString("utf8");
  if (body instanceof Uint8Array) return Buffer.from(body).toString("utf8");

  // AWS SDK v3 GetObject returns a stream-like Body in Node.
  const chunks: Uint8Array[] = [];
  for await (const chunk of body as any) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isNoSuchKey(error: any): boolean {
  const name = error?.name || error?.Code;
  return (
    name === "NoSuchKey" ||
    name === "NotFound" ||
    error?.$metadata?.httpStatusCode === 404
  );
}

export type RunShellExecutorJobArgs = {
  commands: string[];
  timeoutMs?: number;
  maxOutputLength?: number;
};

/**
 * Launches an ECS Fargate task to execute shell commands, then polls S3 for the
 * result JSON uploaded via presigned PUT URL.
 */
export async function runShellExecutorJob(
  args: RunShellExecutorJobArgs,
): Promise<ShellExecutorJobResult> {
  if (!env.shellExecutorResultsBucket) {
    throw new ApiError("Shell executor results bucket is not configured", 500);
  }
  if (!env.shellExecutorClusterArn) {
    throw new ApiError("Shell executor cluster ARN is not configured", 500);
  }
  if (!env.shellExecutorTaskDefinitionArn) {
    throw new ApiError(
      "Shell executor task definition ARN is not configured",
      500,
    );
  }
  if (!env.shellExecutorSecurityGroupId) {
    throw new ApiError(
      "Shell executor security group ID is not configured",
      500,
    );
  }
  if (!env.shellExecutorSubnetIds || env.shellExecutorSubnetIds.length === 0) {
    throw new ApiError("Shell executor subnet IDs are not configured", 500);
  }

  const jobId = ulid();
  const resultKey = `shell-results/${jobId}.json`;
  const jobRequestKey = `shell-jobs/${jobId}.json`;
  const bucket = env.shellExecutorResultsBucket;

  // Generate presigned PUT URL for result
  const putUrl = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: resultKey,
      ContentType: "application/json",
    }),
    { expiresIn: 300 },
  );

  // Build job request
  const jobRequest = shellExecutorJobRequestSchema.parse({
    version: SHELL_EXECUTOR_CONTRACT_VERSION,
    job_id: jobId,
    commands: args.commands,
    timeout_ms: args.timeoutMs,
    max_output_length: args.maxOutputLength,
    result_put_url: putUrl,
    result_content_type: "application/json",
  });

  // Upload job request to S3 and generate presigned GET URL
  // This avoids the 8192 character limit for container overrides
  const jobRequestJson = JSON.stringify(jobRequest);
  const jobRequestSize = Buffer.byteLength(jobRequestJson, "utf8");

  logger.info("[ShellExecutor] Uploading job request to S3", {
    jobId,
    jobRequestSizeBytes: jobRequestSize,
    commandsCount: args.commands.length,
  });

  // Upload job request JSON to S3
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: jobRequestKey,
      Body: jobRequestJson,
      ContentType: "application/json",
    }),
  );

  // Generate presigned GET URL for job request (valid for 15 minutes)
  const jobRequestGetUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: jobRequestKey,
    }),
    { expiresIn: 900 }, // 15 minutes
  );

  // Check if the GET URL would exceed container override limits
  // ECS container overrides have a limit of 8192 characters total
  // A presigned URL is typically 500-800 characters, well under the limit
  const getUrlSize = jobRequestGetUrl.length;
  if (getUrlSize > 8000) {
    // Clean up uploaded job request
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: jobRequestKey,
        }),
      );
    } catch {
      // Ignore cleanup errors
    }
    throw new ApiError(
      `Job request GET URL too large (${getUrlSize} chars). Consider splitting commands into multiple jobs.`,
      400,
    );
  }

  logger.info("[ShellExecutor] Launching task", {
    jobId,
    commands: args.commands.length,
    clusterArn: env.shellExecutorClusterArn,
    jobRequestGetUrlSize: getUrlSize,
  });

  const runResp = await ecsClient.send(
    new RunTaskCommand({
      cluster: env.shellExecutorClusterArn,
      taskDefinition: env.shellExecutorTaskDefinitionArn,
      launchType: "FARGATE",
      platformVersion: "LATEST",
      networkConfiguration: {
        awsvpcConfiguration: {
          assignPublicIp: "DISABLED",
          subnets: env.shellExecutorSubnetIds,
          securityGroups: [env.shellExecutorSecurityGroupId],
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: "runner",
            environment: [
              { name: "SHELL_EXECUTOR_JOB_GET_URL", value: jobRequestGetUrl },
            ],
          },
        ],
      },
      startedBy: "leadmagnet-api",
    }),
  );

  if (runResp.failures && runResp.failures.length > 0) {
    logger.error("[ShellExecutor] ECS RunTask failures", {
      jobId,
      failures: runResp.failures,
    });
    throw new ApiError("Failed to start shell executor task", 500);
  }

  const taskArn = runResp.tasks?.[0]?.taskArn;
  logger.info("[ShellExecutor] Task started", { jobId, taskArn });

  // Poll S3 for result.
  const pollStart = Date.now();
  const perCommandTimeoutMs =
    args.timeoutMs && args.timeoutMs > 0 ? args.timeoutMs : 120_000;
  const maxWaitMs = Math.min(
    10 * 60_000,
    perCommandTimeoutMs * Math.max(1, args.commands.length) + 30_000,
  );

  while (Date.now() - pollStart < maxWaitMs) {
    try {
      const obj = await s3Client.send(
        new GetObjectCommand({ Bucket: bucket, Key: resultKey }),
      );
      const raw = await readBodyAsString((obj as any).Body);
      const parsed = JSON.parse(raw);
      const result = shellExecutorJobResultSchema.parse(parsed);

      // Best-effort cleanup: delete both result and job request
      // Bucket also has lifecycle rules, but cleanup immediately if possible
      try {
        await s3Client.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: resultKey }),
        );
        await s3Client.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: jobRequestKey }),
        );
      } catch {
        // ignore cleanup errors
      }

      return result;
    } catch (error: any) {
      if (isNoSuchKey(error)) {
        await delay(500);
        continue;
      }
      if (error instanceof SyntaxError) {
        throw new ApiError("Shell executor returned invalid JSON", 500);
      }
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error("[ShellExecutor] Error fetching result", {
        jobId,
        taskArn,
        error: error?.message || String(error),
      });
      throw new ApiError("Failed to fetch shell executor result", 500);
    }
  }

  // Clean up job request if we timed out
  try {
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: jobRequestKey }),
    );
  } catch {
    // ignore cleanup errors
  }

  logger.warn("[ShellExecutor] Timed out waiting for result", {
    jobId,
    taskArn,
    maxWaitMs,
  });
  throw new ApiError("Shell executor timed out", 504);
}
