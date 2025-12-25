import { db } from "../utils/db";
import { ApiError } from "../utils/errors";
import { RouteResponse } from "../routes";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { logger } from "../utils/logger";
import { env } from "../utils/env";
import { exec } from "child_process";
import { promisify } from "util";
import { resolve, dirname, isAbsolute } from "path";
import { existsSync } from "fs";

const execAsync = promisify(exec);

const JOBS_TABLE = env.jobsTable;
const STEP_FUNCTIONS_ARN = env.stepFunctionsArn;
const sfnClient = STEP_FUNCTIONS_ARN
  ? new SFNClient({ region: env.awsRegion })
  : null;

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
  // __dirname in compiled JS will be backend/api/dist/controllers
  // So we need to go up: controllers -> dist -> api -> backend -> project root
  const controllersDir = __dirname; // backend/api/dist/controllers
  const distDir = dirname(controllersDir); // backend/api/dist
  const apiDir = dirname(distDir); // backend/api
  const backendDir = dirname(apiDir); // backend
  const projectRoot = dirname(backendDir); // project root (where backend/ folder is)

  // Resolve worker path relative to project root
  // workerPath is like './backend/worker/worker.py'
  return resolve(projectRoot, workerPath);
}

/**
 * Controller for job rerun operations.
 * Handles rerunning individual steps or entire jobs.
 */
export class JobRerunController {
  /**
   * Rerun a specific step in a job.
   * @param continueAfter If true, continue processing remaining steps after rerunning this step.
   */
  async rerunStep(
    tenantId: string,
    jobId: string,
    stepIndex: number,
    continueAfter: boolean = false,
  ): Promise<RouteResponse> {
    // Get the job
    const job = await db.get(JOBS_TABLE, { job_id: jobId });

    if (!job) {
      throw new ApiError("Job not found", 404);
    }

    if (job.tenant_id !== tenantId) {
      throw new ApiError(
        "You don't have permission to rerun steps for this job",
        403,
      );
    }

    // Get the workflow to validate step index
    const WORKFLOWS_TABLE = env.workflowsTable;
    const workflow = await db.get(WORKFLOWS_TABLE, {
      workflow_id: job.workflow_id,
    });
    if (!workflow) {
      throw new ApiError("Workflow not found", 404);
    }

    const steps = workflow.steps || [];
    if (stepIndex < 0 || stepIndex >= steps.length) {
      throw new ApiError(
        `Invalid step index: ${stepIndex}. Workflow has ${steps.length} steps.`,
        400,
      );
    }

    // Update job status to processing if it's completed
    if (job.status === "completed") {
      await db.update(
        JOBS_TABLE,
        { job_id: jobId },
        {
          status: "processing",
          updated_at: new Date().toISOString(),
        },
      );
    }

    // Start Step Functions execution with step_index parameter
    try {
      if (env.isDevelopment() || !STEP_FUNCTIONS_ARN) {
        logger.info("Local mode detected, processing step rerun directly", {
          jobId,
          stepIndex,
          continueAfter,
        });

        // Resolve worker script path
        const workerPath = resolveWorkerPath(env.workerScriptPath);
        const workerDir = dirname(workerPath);

        // Validate that the worker script exists
        if (!existsSync(workerPath)) {
          const errorMsg = `Worker script not found at path: ${workerPath}`;
          logger.error("[Job Rerun Controller] Worker script not found", {
            jobId,
            workerPath,
            workerDir,
            cwd: process.cwd(),
            resolvedFrom: env.workerScriptPath,
          });
          throw new ApiError(errorMsg, 500);
        }

        // Call worker with STEP_INDEX and CONTINUE_AFTER environment variables
        const command = `python3 ${JSON.stringify(workerPath)}`;
        logger.info(
          "[Job Rerun Controller] Executing worker command for step rerun",
          {
            jobId,
            stepIndex,
            continueAfter,
            command,
            cwd: workerDir,
          },
        );

        try {
          const { stdout, stderr } = await execAsync(command, {
            cwd: workerDir,
            env: {
              ...process.env,
              JOB_ID: jobId,
              STEP_INDEX: stepIndex.toString(),
              CONTINUE_AFTER: continueAfter ? "true" : "false",
            },
            timeout: 1800000, // 30 minute timeout
            maxBuffer: 50 * 1024 * 1024, // 50MB buffer
          });

          logger.info("[Job Rerun Controller] Step rerun completed", {
            jobId,
            stepIndex,
            stdout,
            stderr,
          });

          return {
            statusCode: 200,
            body: {
              message: continueAfter
                ? "Step rerun and continue initiated"
                : "Step rerun initiated",
              job_id: jobId,
              step_index: stepIndex,
            },
          };
        } catch (execError: any) {
          const errorMessage = execError.message || "Unknown error";
          const stderrOutput = execError.stderr || "";
          const stdoutOutput = execError.stdout || "";

          logger.error("[Job Rerun Controller] Worker execution failed", {
            jobId,
            stepIndex,
            error: errorMessage,
            stderr: stderrOutput,
            stdout: stdoutOutput,
            code: execError.code,
            signal: execError.signal,
          });

          throw new ApiError(`Failed to rerun step: ${errorMessage}`, 500);
        }
      } else {
        // Determine action based on continueAfter flag
        const action = continueAfter
          ? "process_single_step_and_continue"
          : "process_single_step";

        const command = new StartExecutionCommand({
          stateMachineArn: STEP_FUNCTIONS_ARN,
          input: JSON.stringify({
            job_id: jobId,
            tenant_id: job.tenant_id,
            workflow_id: job.workflow_id,
            submission_id: job.submission_id,
            step_index: stepIndex,
            step_type: "workflow_step",
            action: action,
            continue_after: continueAfter,
          }),
        });

        await sfnClient!.send(command);
        logger.info("Started Step Functions execution for step rerun", {
          jobId,
          stepIndex,
          continueAfter,
          action,
        });

        return {
          statusCode: 200,
          body: {
            message: continueAfter
              ? "Step rerun and continue initiated"
              : "Step rerun initiated",
            job_id: jobId,
            step_index: stepIndex,
          },
        };
      }
    } catch (error: any) {
      logger.error("Error starting step rerun", {
        jobId,
        stepIndex,
        error: error.message,
        errorStack: error.stack,
      });
      throw new ApiError(`Failed to rerun step: ${error.message}`, 500);
    }
  }
}

export const jobRerunController = new JobRerunController();
