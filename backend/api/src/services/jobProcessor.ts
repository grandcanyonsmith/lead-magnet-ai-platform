import { exec } from "child_process";
import { promisify } from "util";
import { resolve, dirname, isAbsolute } from "path";
import { existsSync } from "fs";
import { db } from "../utils/db";
import { logger } from "../utils/logger";
import { env } from "../utils/env";

const execAsync = promisify(exec);

const JOBS_TABLE = env.jobsTable;

/**
 * Resolve worker script path relative to project root.
 * Works whether running from root or backend/api directory.
 */
function resolveWorkerPath(workerPath: string): string {
  // If path is absolute, use as-is
  if (isAbsolute(workerPath)) {
    return workerPath;
  }

  // Get the project root (where backend/ folder is)
  // __dirname in compiled JS will be backend/api/dist/services
  // So we need to go up: services -> dist -> api -> backend -> project root
  const servicesDir = __dirname; // backend/api/dist/services
  const distDir = dirname(servicesDir); // backend/api/dist
  const apiDir = dirname(distDir); // backend/api
  const backendDir = dirname(apiDir); // backend
  const projectRoot = dirname(backendDir); // project root (where backend/ folder is)

  // Resolve worker path relative to project root
  // workerPath is like './backend/worker/worker.py'
  return resolve(projectRoot, workerPath);
}

/**
 * Process a job locally by calling the Python worker script
 */
export async function processJobLocally(
  jobId: string,
  _tenantId: string,
  _workflowId: string,
  _submissionId: string,
): Promise<void> {
  logger.info("[Local Job Processor] Starting local job processing", { jobId });

  try {
    // Update job status to processing
    await db.update(
      JOBS_TABLE,
      { job_id: jobId },
      {
        status: "processing",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    );

    // Resolve worker script path relative to project root
    const workerPath = resolveWorkerPath(env.workerScriptPath);
    const workerDir = dirname(workerPath);

    // Validate that the worker script exists
    if (!existsSync(workerPath)) {
      const errorMsg = `Worker script not found at path: ${workerPath}`;
      logger.error("[Local Job Processor] Worker script not found", {
        jobId,
        workerPath,
        workerDir,
        cwd: process.cwd(),
        resolvedFrom: env.workerScriptPath,
      });
      await db.update(
        JOBS_TABLE,
        { job_id: jobId },
        {
          status: "failed",
          error_message: errorMsg,
          updated_at: new Date().toISOString(),
        },
      );
      throw new Error(errorMsg);
    }

    logger.info("[Local Job Processor] Resolved worker path", {
      jobId,
      workerPath,
      workerDir,
      cwd: process.cwd(),
    });

    // Track duration for debugging long-running local jobs
    const startTime = Date.now();

    try {
      // Set JOB_ID environment variable and run worker
      // Run from worker directory so Python imports work correctly
      // Use absolute path and quote it to handle spaces or special characters
      const command = `python3 ${JSON.stringify(workerPath)}`;
      logger.debug("[Local Job Processor] Executing worker command", {
        jobId,
        command,
        cwd: workerDir,
        hasJobId: !!process.env.JOB_ID,
      });

      const { stdout, stderr } = await execAsync(command, {
        cwd: workerDir,
        env: { ...process.env, JOB_ID: jobId },
        timeout: 1800000, // 30 minute timeout to allow larger workflows
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for verbose logs
      });

      logger.info("[Local Job Processor] Worker completed", {
        jobId,
        stdout,
        stderr,
        durationMs: Date.now() - startTime,
      });
    } catch (execError: any) {
      // If Python worker fails, log and mark as failed
      const errorMessage = execError.message || "Unknown error";
      const stderrOutput = execError.stderr || "";
      const stdoutOutput = execError.stdout || "";

      logger.error("[Local Job Processor] Worker execution failed", {
        jobId,
        error: errorMessage,
        stderr: stderrOutput,
        stdout: stdoutOutput,
        code: execError.code,
        signal: execError.signal,
        durationMs: Date.now() - startTime,
        workerPath,
        workerDir,
      });

      // Include stderr and stdout in error message for better debugging
      let fullErrorMessage = `Worker execution failed: ${errorMessage}`;
      if (stderrOutput) {
        fullErrorMessage += `\n\nSTDERR:\n${stderrOutput}`;
      }
      if (stdoutOutput) {
        fullErrorMessage += `\n\nSTDOUT:\n${stdoutOutput}`;
      }

      // Update job status with full error details
      await db.update(
        JOBS_TABLE,
        { job_id: jobId },
        {
          status: "failed",
          error_message: fullErrorMessage,
          updated_at: new Date().toISOString(),
        },
      );

      // Create a new error with the full message to preserve stderr/stdout
      const enhancedError = new Error(fullErrorMessage);
      (enhancedError as any).code = execError.code;
      (enhancedError as any).signal = execError.signal;
      (enhancedError as any).stderr = stderrOutput;
      (enhancedError as any).stdout = stdoutOutput;
      throw enhancedError;
    }
  } catch (error: any) {
    logger.error("[Local Job Processor] Error processing job", {
      jobId,
      error: error.message,
      errorStack: error.stack,
      stderr: error.stderr,
      stdout: error.stdout,
    });

    // Use the full error message if available (includes stderr/stdout), otherwise use message
    const errorMessage = error.message || "Unknown error";

    // Update job status to failed - only update if not already updated by inner catch
    // Check if error message already includes "Worker execution failed" to avoid double update
    if (!errorMessage.includes("Worker execution failed")) {
      await db.update(
        JOBS_TABLE,
        { job_id: jobId },
        {
          status: "failed",
          error_message: `Processing failed: ${errorMessage}`,
          updated_at: new Date().toISOString(),
        },
      );
    }

    throw error;
  }
}
