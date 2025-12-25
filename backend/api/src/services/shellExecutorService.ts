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
  const key = `shell-results/${jobId}.json`;
  const bucket = env.shellExecutorResultsBucket;

  const putUrl = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: "application/json",
    }),
    { expiresIn: 300 },
  );

  const jobRequest = shellExecutorJobRequestSchema.parse({
    version: SHELL_EXECUTOR_CONTRACT_VERSION,
    job_id: jobId,
    commands: args.commands,
    timeout_ms: args.timeoutMs,
    max_output_length: args.maxOutputLength,
    result_put_url: putUrl,
    result_content_type: "application/json",
  });

  const jobB64 = Buffer.from(JSON.stringify(jobRequest), "utf8").toString(
    "base64",
  );

  logger.info("[ShellExecutor] Launching task", {
    jobId,
    commands: args.commands.length,
    clusterArn: env.shellExecutorClusterArn,
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
            environment: [{ name: "SHELL_EXECUTOR_JOB_B64", value: jobB64 }],
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
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      const raw = await readBodyAsString((obj as any).Body);
      const parsed = JSON.parse(raw);
      const result = shellExecutorJobResultSchema.parse(parsed);

      // Best-effort cleanup (bucket also has lifecycle rules).
      try {
        await s3Client.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: key }),
        );
      } catch {
        // ignore
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

  logger.warn("[ShellExecutor] Timed out waiting for result", {
    jobId,
    taskArn,
    maxWaitMs,
  });
  throw new ApiError("Shell executor timed out", 504);
}
