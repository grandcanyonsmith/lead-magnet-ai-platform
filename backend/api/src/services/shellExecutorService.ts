import { ECSClient, RunTaskCommand, DescribeTasksCommand } from "@aws-sdk/client-ecs";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
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
const lambdaClient = new LambdaClient({ region: env.awsRegion });
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
  workspaceId?: string;
  resetWorkspace?: boolean;
};

class ShellExecutorService {
  private useLambda(): boolean {
    // Prefer Lambda if function name is configured (newer implementation)
    return !!env.shellExecutorFunctionName;
  }

  private validateConfig() {
    if (this.useLambda()) {
      if (!env.shellExecutorFunctionName) {
        throw new ApiError("Shell executor function name is not configured", 500);
      }
      return; // Lambda doesn't need ECS/S3 config
    }
    
    // ECS Fargate configuration (legacy)
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
  }

  private async generateResultPutUrl(bucket: string, key: string): Promise<string> {
    // Generate presigned PUT URL for result
    // Expiration must be longer than max task duration (20 min per command) + buffer
    // Set to 30 minutes (1800 seconds) to ensure URL doesn't expire before task completes
    return await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: "application/json",
      }),
      { expiresIn: 1800 }, // 30 minutes
    );
  }

  private async uploadJobRequest(
    bucket: string,
    key: string,
    jobRequest: any,
    jobId: string,
    commandsCount: number
  ): Promise<string> {
    const jobRequestJson = JSON.stringify(jobRequest);
    const jobRequestSize = Buffer.byteLength(jobRequestJson, "utf8");

    logger.info("[ShellExecutor] Uploading job request to S3", {
      jobId,
      jobRequestSizeBytes: jobRequestSize,
      commandsCount,
    });

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: jobRequestJson,
        ContentType: "application/json",
      }),
    );

    // Generate presigned GET URL for job request (valid for 15 minutes)
    const jobRequestGetUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { expiresIn: 900 }, // 15 minutes
    );

    // Check if the GET URL would exceed container override limits
    const getUrlSize = jobRequestGetUrl.length;
    if (getUrlSize > 8000) {
      await this.cleanupS3Object(bucket, key);
      throw new ApiError(
        `Job request GET URL too large (${getUrlSize} chars). Consider splitting commands into multiple jobs.`,
        400,
      );
    }

    return jobRequestGetUrl;
  }

  private async launchTask(jobId: string, jobRequestGetUrl: string, jobRequestJson?: string): Promise<string> {
    const getUrlSize = jobRequestGetUrl.length;
    logger.info("[ShellExecutor] Launching task", {
      jobId,
      clusterArn: env.shellExecutorClusterArn,
      jobRequestGetUrlSize: getUrlSize,
      usingDirectJson: !!jobRequestJson,
    });

    // Build environment variables - try direct JSON first if small enough, otherwise use URL
    const envVars: Array<{ name: string; value: string }> = [];
    
    if (jobRequestJson && jobRequestJson.length < 8000) {
      // Pass job data directly as JSON (container expects SHELL_EXECUTOR_JOB_JSON)
      envVars.push({ name: "SHELL_EXECUTOR_JOB_JSON", value: jobRequestJson });
    } else {
      // Fall back to URL if JSON is too large
      envVars.push({ name: "SHELL_EXECUTOR_JOB_GET_URL", value: jobRequestGetUrl });
    }

    const runResp = await ecsClient.send(
      new RunTaskCommand({
        cluster: env.shellExecutorClusterArn,
        taskDefinition: env.shellExecutorTaskDefinitionArn,
        // Use Fargate launch type (capacity provider strategy requires association with cluster)
        launchType: "FARGATE",
        platformVersion: "LATEST",
        networkConfiguration: {
          awsvpcConfiguration: {
            assignPublicIp: "ENABLED", // Enable public IP for internet access to pull images and access S3
            subnets: env.shellExecutorSubnetIds,
            securityGroups: [env.shellExecutorSecurityGroupId!],
          },
        },
        overrides: {
          containerOverrides: [
            {
              name: "runner",
              environment: envVars,
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
    if (!taskArn) {
        throw new ApiError("Task ARN not found in response", 500);
    }
    
    logger.info("[ShellExecutor] Task started", { jobId, taskArn });
    return taskArn;
  }

  private async checkTaskStatus(jobId: string, taskArn: string): Promise<void> {
    try {
      const desc = await ecsClient.send(
        new DescribeTasksCommand({
          cluster: env.shellExecutorClusterArn,
          tasks: [taskArn],
        }),
      );
      const task = desc.tasks?.[0];
      if (task?.lastStatus === "STOPPED") {
        const container =
          task.containers?.find((c) => c.name === "runner") ||
          task.containers?.[0];
        const exitCode = container?.exitCode;
        const reason =
          container?.reason || task.stoppedReason || "unknown";

        throw new ApiError(
          `Shell executor task stopped before uploading result (exit_code=${exitCode}): ${reason}`,
          500,
        );
      }
    } catch (checkErr) {
      if (checkErr instanceof ApiError) throw checkErr;
      // Ignore other check errors to avoid crashing the polling loop
      logger.warn("[ShellExecutor] Failed to check task status", {
        jobId,
        error: checkErr,
      });
    }
  }

  private async cleanupS3Object(bucket: string, key: string): Promise<void> {
    try {
      await s3Client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key }),
      );
    } catch {
      // ignore cleanup errors
    }
  }

  private async pollForResult(
    bucket: string,
    resultKey: string,
    jobRequestKey: string,
    jobId: string,
    taskArn: string,
    args: RunShellExecutorJobArgs
  ): Promise<ShellExecutorJobResult> {
    const pollStart = Date.now();
    const perCommandTimeoutMs =
      args.timeoutMs && args.timeoutMs > 0 ? args.timeoutMs : 120_000;
    const maxWaitMs = Math.min(
      10 * 60_000,
      perCommandTimeoutMs * Math.max(1, args.commands.length) + 30_000,
    );

    let lastTaskCheck = 0;
    const taskCheckIntervalMs = 5000;

    while (Date.now() - pollStart < maxWaitMs) {
      try {
        const obj = await s3Client.send(
          new GetObjectCommand({ Bucket: bucket, Key: resultKey }),
        );
        const raw = await readBodyAsString((obj as any).Body);
        const parsed = JSON.parse(raw);
        const result = shellExecutorJobResultSchema.parse(parsed);

        // Best-effort cleanup
        await Promise.all([
          this.cleanupS3Object(bucket, resultKey),
          this.cleanupS3Object(bucket, jobRequestKey)
        ]);

        return result;
      } catch (error: any) {
        if (isNoSuchKey(error)) {
          // Fast failure check: If task stopped without result, fail immediately
          const now = Date.now();
          if (taskArn && now - lastTaskCheck >= taskCheckIntervalMs) {
            lastTaskCheck = now;
            await this.checkTaskStatus(jobId, taskArn);
          }

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
    await this.cleanupS3Object(bucket, jobRequestKey);

    logger.warn("[ShellExecutor] Timed out waiting for result", {
      jobId,
      taskArn,
      maxWaitMs,
    });
    throw new ApiError("Shell executor timed out", 504);
  }

  /**
   * Executes shell commands via Lambda (preferred) or ECS Fargate (legacy).
   */
  public async runShellExecutorJob(
    args: RunShellExecutorJobArgs,
  ): Promise<ShellExecutorJobResult> {
    this.validateConfig();

    // Use Lambda if available (newer, more reliable)
    if (this.useLambda()) {
      return await this.runShellExecutorJobLambda(args);
    }

    // Fall back to ECS Fargate (legacy)
    return await this.runShellExecutorJobECS(args);
  }

  /**
   * Execute shell commands via Lambda function (preferred method).
   */
  private async runShellExecutorJobLambda(
    args: RunShellExecutorJobArgs,
  ): Promise<ShellExecutorJobResult> {
    const functionName = env.shellExecutorFunctionName!.replace(/:$LATEST$/, "");
    
    // Lambda expects: { commands, workspace_id, reset_workspace, timeout_ms, max_output_length, env }
    const lambdaPayload = {
      commands: args.commands,
      workspace_id: args.workspaceId,
      reset_workspace: args.resetWorkspace,
      timeout_ms: args.timeoutMs || 120000,
      max_output_length: args.maxOutputLength || 4096,
      env: {},
    };

    logger.info("[ShellExecutor] Invoking Lambda function", {
      functionName,
      commandsCount: args.commands.length,
    });

    const response = await lambdaClient.send(
      new InvokeCommand({
        FunctionName: functionName,
        Payload: JSON.stringify(lambdaPayload),
      })
    );

    if (response.FunctionError) {
      const errorPayload = response.Payload
        ? JSON.parse(Buffer.from(response.Payload).toString("utf-8"))
        : {};
      throw new ApiError(
        `Lambda execution failed: ${errorPayload.errorMessage || response.FunctionError}`,
        500
      );
    }

    const responsePayload = response.Payload
      ? JSON.parse(Buffer.from(response.Payload).toString("utf-8"))
      : {};

    if (responsePayload.statusCode !== 200) {
      throw new ApiError(
        `Shell executor failed: ${responsePayload.error || "Unknown error"}`,
        500
      );
    }

    // Map Lambda response to ShellExecutorJobResult format
    const results = responsePayload.results || [];
    const output = results.map((res: any) => ({
      stdout: res.stdout || "",
      stderr: res.stderr || "",
      outcome: {
        type: res.status === "timeout" ? "timeout" : "exit",
        exit_code: res.exit_code || (res.status === "timeout" ? undefined : 0),
      },
    }));

    return {
      version: SHELL_EXECUTOR_CONTRACT_VERSION,
      job_id: ulid(),
      commands: args.commands,
      max_output_length: args.maxOutputLength,
      output,
    };
  }

  /**
   * Execute shell commands via ECS Fargate (legacy method).
   */
  private async runShellExecutorJobECS(
    args: RunShellExecutorJobArgs,
  ): Promise<ShellExecutorJobResult> {
    const jobId = ulid();
    const resultKey = `shell-results/${jobId}.json`;
    const jobRequestKey = `shell-jobs/${jobId}.json`;
    const bucket = env.shellExecutorResultsBucket!;

    const putUrl = await this.generateResultPutUrl(bucket, resultKey);

    // Build job request
    const jobRequest = shellExecutorJobRequestSchema.parse({
      version: SHELL_EXECUTOR_CONTRACT_VERSION,
      job_id: jobId,
      workspace_id: args.workspaceId,
      reset_workspace: args.resetWorkspace,
      commands: args.commands,
      timeout_ms: args.timeoutMs,
      max_output_length: args.maxOutputLength,
      result_put_url: putUrl,
      result_content_type: "application/json",
    });

    const jobRequestGetUrl = await this.uploadJobRequest(
      bucket,
      jobRequestKey,
      jobRequest,
      jobId,
      args.commands.length
    );

    // Pass job request JSON directly for containers that expect SHELL_EXECUTOR_JOB_JSON
    const jobRequestJson = JSON.stringify(jobRequest);

    const taskArn = await this.launchTask(jobId, jobRequestGetUrl, jobRequestJson);

    return await this.pollForResult(
      bucket,
      resultKey,
      jobRequestKey,
      jobId,
      taskArn,
      args
    );
  }
}

export const shellExecutorService = new ShellExecutorService();
export const runShellExecutorJob = shellExecutorService.runShellExecutorJob.bind(shellExecutorService);
