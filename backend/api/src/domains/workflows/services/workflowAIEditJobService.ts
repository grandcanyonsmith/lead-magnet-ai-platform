import { ulid } from "ulid";
import { db } from "@utils/db";
import { logger } from "@utils/logger";
import { env } from "@utils/env";
import { JobProcessingUtils } from "./workflow/workflowJobProcessingService";
import { getOpenAIClient } from "@services/openaiService";
import { WorkflowAIService, WorkflowAIEditRequest } from "./workflowAIService";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const JOBS_TABLE = env.jobsTable;

type StartWorkflowAIEditInput = {
  tenantId: string;
  workflowId: string;
  userPrompt: string;
  contextJobId?: string;
};

class WorkflowAIEditJobService {
  async startWorkflowAIEdit({
    tenantId,
    workflowId,
    userPrompt,
    contextJobId,
  }: StartWorkflowAIEditInput): Promise<{ jobId: string }> {
    const jobId = `wfaiedit_${ulid()}`;
    const now = new Date().toISOString();

    const jobRecord: Record<string, any> = {
      job_id: jobId,
      tenant_id: tenantId,
      workflow_id: workflowId,
      job_type: "workflow_ai_edit",
      status: "pending",
      model: "gpt-5.2",
      user_prompt: userPrompt,
      context_job_id: contextJobId || null,
      result: null,
      error_message: null,
      created_at: now,
      updated_at: now,
    };

    await db.put(JOBS_TABLE, jobRecord);
    logger.info("[Workflow AI Edit] Created job record", {
      jobId,
      tenantId,
      workflowId,
      hasContextJobId: !!contextJobId,
    });

    await JobProcessingUtils.triggerAsyncProcessing(
      jobId,
      tenantId,
      {
        source: "workflow-ai-edit-job",
        workflow_id: workflowId,
        user_prompt: userPrompt,
        context_job_id: contextJobId || null,
      },
      async (localJobId: string, localTenantId: string) => {
        await this.processWorkflowAIEditJob(
          localJobId,
          localTenantId,
          workflowId,
          userPrompt,
          contextJobId,
        );
      },
    );

    return { jobId };
  }

  async getJob(jobId: string): Promise<Record<string, any> | null> {
    const job = await db.get(JOBS_TABLE, { job_id: jobId });
    return job ?? null;
  }

  async ensureLocalProcessing(job: Record<string, any>): Promise<void> {
    if (!job || job.status !== "pending" || !env.isDevelopment()) {
      return;
    }

    const createdAt = new Date(job.created_at).getTime();
    const ageSeconds = (Date.now() - createdAt) / 1000;

    if (Number.isNaN(ageSeconds) || ageSeconds <= 30 || job.processing_attempted) {
      return;
    }

    logger.info("[Workflow AI Edit] Job stuck in pending, attempting to process", {
      jobId: job.job_id,
      ageSeconds,
    });

    await db.update(JOBS_TABLE, { job_id: job.job_id }, {
      processing_attempted: true,
      updated_at: new Date().toISOString(),
    });

    const workflowId = String(job.workflow_id || "");
    const userPrompt = String(job.user_prompt || "");
    const contextJobId = job.context_job_id ? String(job.context_job_id) : undefined;

    setImmediate(async () => {
      try {
        await this.processWorkflowAIEditJob(
          job.job_id,
          job.tenant_id,
          workflowId,
          userPrompt,
          contextJobId,
        );
      } catch (error: any) {
        logger.error("[Workflow AI Edit] Error processing stuck job", {
          jobId: job.job_id,
          error: error.message,
          stack: error.stack,
        });
      }
    });
  }

  async processWorkflowAIEditJob(
    jobId: string,
    tenantId: string,
    workflowId: string,
    userPrompt: string,
    contextJobId?: string,
  ): Promise<void> {
    const WORKFLOWS_TABLE = env.workflowsTable;
    const SUBMISSIONS_TABLE = env.submissionsTable;
    const ARTIFACTS_TABLE = env.artifactsTable;
    const ARTIFACTS_BUCKET = env.artifactsBucket;

    logger.info("[Workflow AI Edit] Processing job", {
      jobId,
      tenantId,
      workflowId,
      hasContextJobId: !!contextJobId,
    });

    const job = await db.get(JOBS_TABLE, { job_id: jobId });
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    try {
      await db.update(JOBS_TABLE, { job_id: jobId }, {
        status: "processing",
        updated_at: new Date().toISOString(),
      });

      // Validate workflow belongs to tenant
      const workflow = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });
      if (!workflow || workflow.deleted_at) {
        throw new Error("This lead magnet doesn't exist or has been removed");
      }
      if (workflow.tenant_id !== tenantId) {
        throw new Error("Unauthorized");
      }

      // ---------------------------------------------------------
      // CONTEXT GATHERING (Parallelized)
      // ---------------------------------------------------------
      let executionHistory: any = undefined;
      const referenceExamples: any[] = [];

      const s3Client = new S3Client({ region: env.awsRegion });

      const fetchS3Json = async (key: string) => {
        try {
          const cmd = new GetObjectCommand({ Bucket: ARTIFACTS_BUCKET, Key: key });
          const res = await s3Client.send(cmd);
          if (res.Body) {
            const str = await res.Body.transformToString();
            return JSON.parse(str);
          }
        } catch (e: any) {
          logger.warn("[WorkflowAI Edit Job] Failed to fetch S3 JSON", {
            key,
            error: e.message,
          });
        }
        return null;
      };

      const fetchS3Text = async (key: string) => {
        try {
          const cmd = new GetObjectCommand({ Bucket: ARTIFACTS_BUCKET, Key: key });
          const res = await s3Client.send(cmd);
          if (res.Body) {
            return await res.Body.transformToString();
          }
        } catch (e: any) {
          logger.warn("[WorkflowAI Edit Job] Failed to fetch S3 Text", {
            key,
            error: e.message,
          });
        }
        return null;
      };

      // Context job
      const contextJobPromise = (async () => {
        if (!contextJobId) return;

        try {
          const ctxJob = await db.get(JOBS_TABLE, { job_id: contextJobId });
          if (ctxJob && ctxJob.tenant_id === tenantId) {
            const history: any = {};

            const submissionPromise = ctxJob.submission_id
              ? db.get(SUBMISSIONS_TABLE, { submission_id: ctxJob.submission_id })
              : Promise.resolve(null);

            const stepsPromise = ctxJob.execution_steps_s3_key
              ? fetchS3Json(String(ctxJob.execution_steps_s3_key))
              : Promise.resolve(ctxJob.execution_steps || null);

            let artifactPromise: Promise<string | null> = Promise.resolve(null);
            if (
              ARTIFACTS_TABLE &&
              ctxJob.artifacts &&
              Array.isArray(ctxJob.artifacts) &&
              ctxJob.artifacts.length > 0
            ) {
              const finalArtifactId = ctxJob.artifacts[ctxJob.artifacts.length - 1];
              artifactPromise = db
                .get(ARTIFACTS_TABLE, { artifact_id: finalArtifactId })
                .then((artifact) => {
                  if (artifact && artifact.s3_key) {
                    return fetchS3Text(String(artifact.s3_key));
                  }
                  return null;
                });
            }

            const [submission, steps, finalArtifactText] = await Promise.all([
              submissionPromise,
              stepsPromise,
              artifactPromise,
            ]);

            if (submission) {
              history.submissionData = submission.submission_data;
            }
            if (steps) {
              history.stepExecutionResults = steps;
            }
            if (finalArtifactText) {
              history.finalArtifactSummary = finalArtifactText;
            }

            executionHistory = history;
          }
        } catch (err: any) {
          logger.error("[WorkflowAI Edit Job] Failed to fetch context job", {
            contextJobId,
            error: err.message,
          });
        }
      })();

      // Reference examples
      const referenceExamplesPromise = (async () => {
        try {
          const examplesRes = await db.query(
            JOBS_TABLE,
            "gsi_workflow_status",
            "workflow_id = :wId AND #s = :s",
            { ":wId": workflowId, ":s": "completed" },
            { "#s": "status" },
            5,
          );

          const potentialExamples = examplesRes.items || [];
          const filtered = potentialExamples.filter(
            (j: any) => j.job_id !== contextJobId,
          );

          const examplePromises = filtered.slice(0, 2).map(async (exJob: any) => {
            const exData: any = { jobId: exJob.job_id };

            const subPromise = exJob.submission_id
              ? db.get(SUBMISSIONS_TABLE, { submission_id: exJob.submission_id })
              : Promise.resolve(null);

            let artPromise: Promise<string | null> = Promise.resolve(null);
            if (
              ARTIFACTS_TABLE &&
              exJob.artifacts &&
              Array.isArray(exJob.artifacts) &&
              exJob.artifacts.length > 0
            ) {
              const artId = exJob.artifacts[exJob.artifacts.length - 1];
              artPromise = db
                .get(ARTIFACTS_TABLE, { artifact_id: artId })
                .then((art) => {
                  if (art && art.s3_key) {
                    return fetchS3Text(String(art.s3_key));
                  }
                  return null;
                });
            }

            const [sub, txt] = await Promise.all([subPromise, artPromise]);
            if (sub) exData.submissionData = sub.submission_data;
            if (txt) exData.finalArtifactSummary = txt;

            if (exData.submissionData && exData.finalArtifactSummary) {
              return exData;
            }
            return null;
          });

          const results = await Promise.all(examplePromises);
          results.forEach((res) => {
            if (res) referenceExamples.push(res);
          });
        } catch (err: any) {
          logger.warn("[WorkflowAI Edit Job] Failed to fetch reference examples", {
            error: err.message,
          });
        }
      })();

      await Promise.all([contextJobPromise, referenceExamplesPromise]);

      // ---------------------------------------------------------
      // OPENAI CALL
      // ---------------------------------------------------------
      const openai = await getOpenAIClient();
      const aiService = new WorkflowAIService(openai);

      const aiRequest: WorkflowAIEditRequest = {
        userPrompt: userPrompt,
        workflowContext: {
          workflow_id: workflowId,
          workflow_name: workflow.workflow_name || "Untitled Workflow",
          workflow_description: workflow.workflow_description || "",
          template_id: workflow.template_id,
          current_steps: workflow.steps || [],
        },
        executionHistory,
        referenceExamples,
      };

      const result = await aiService.editWorkflow(aiRequest);

      await db.update(JOBS_TABLE, { job_id: jobId }, {
        status: "completed",
        result,
        updated_at: new Date().toISOString(),
      });

      logger.info("[Workflow AI Edit] Job completed successfully", {
        jobId,
        workflowId,
        stepCount: result.steps?.length,
      });
    } catch (error: any) {
      const errorMessage = error?.message || "Unknown error";
      logger.error("[Workflow AI Edit] Job failed", {
        jobId,
        workflowId,
        error: errorMessage,
        stack: error?.stack,
      });

      await db.update(JOBS_TABLE, { job_id: jobId }, {
        status: "failed",
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      });

      throw error;
    }
  }
}

export const workflowAIEditJobService = new WorkflowAIEditJobService();


