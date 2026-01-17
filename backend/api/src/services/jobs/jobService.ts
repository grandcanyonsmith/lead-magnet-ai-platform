import { db } from "../../utils/db";
import { env } from "../../utils/env";
import { ApiError } from "../../utils/errors";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { generateExecutionStepsUrl } from "../../utils/executionStepsUtils";

const JOBS_TABLE = env.jobsTable;
const ARTIFACTS_BUCKET = env.artifactsBucket;
const ARTIFACTS_TABLE = env.artifactsTable;

const s3Client = new S3Client({ region: env.awsRegion });

const INTERNAL_JOB_TYPES = new Set(["workflow_generation", "workflow_ai_edit"]);
const INTERNAL_JOB_PREFIXES = ["wfgen_", "wfaiedit_"];

const isInternalWorkflowJob = (job: any): boolean => {
  const jobType = typeof job?.job_type === "string" ? job.job_type : "";
  if (jobType && INTERNAL_JOB_TYPES.has(jobType)) {
    return true;
  }
  const jobId = typeof job?.job_id === "string" ? job.job_id : "";
  return INTERNAL_JOB_PREFIXES.some((prefix) => jobId.startsWith(prefix));
};

const filterRunJobs = (jobs: any[]) =>
  jobs.filter((job) => !isInternalWorkflowJob(job));

export class JobService {
  async listJobs(
    tenantId: string,
    queryParams: Record<string, any>
  ): Promise<any> {
    const workflowId = queryParams.workflow_id;
    const status = queryParams.status;
    const includeAll =
      queryParams.all === true ||
      queryParams.all === "true" ||
      queryParams.all === "1";
    const pageSize = queryParams.limit ? parseInt(queryParams.limit) : 20;
    const offset = queryParams.offset ? parseInt(queryParams.offset) : 0;
    const fetchLimit = pageSize + offset;

    let jobs;
    let totalCount = 0;
    let lastEvaluatedKey: Record<string, any> | undefined;
    const queryAll = async (
      indexName: string | undefined,
      keyCondition: string,
      expressionAttributeValues: Record<string, any>,
      expressionAttributeNames?: Record<string, string>,
    ) => {
      const collected: any[] = [];
      let lastKey: Record<string, any> | undefined;
      const pageLimit = 200;

      do {
        const result = await db.query(
          JOBS_TABLE,
          indexName,
          keyCondition,
          expressionAttributeValues,
          expressionAttributeNames,
          pageLimit,
          lastKey,
        );
        collected.push(...result.items);
        lastKey = result.lastEvaluatedKey;
      } while (lastKey);

      return collected;
    };

    if (workflowId) {
      const keyCondition = status
        ? "workflow_id = :workflow_id AND #status = :status"
        : "workflow_id = :workflow_id";
      const expressionAttributeValues = status
        ? { ":workflow_id": workflowId, ":status": status }
        : { ":workflow_id": workflowId };
      const expressionAttributeNames = status ? { "#status": "status" } : undefined;

      jobs = await queryAll(
        "gsi_workflow_status",
        keyCondition,
        expressionAttributeValues,
        expressionAttributeNames,
      );
      jobs = filterRunJobs(jobs);
      totalCount = jobs.length;
    } else {
      const result = await db.query(
        JOBS_TABLE,
        "gsi_tenant_created",
        "tenant_id = :tenant_id",
        { ":tenant_id": tenantId },
        undefined,
        fetchLimit
      );
      jobs = filterRunJobs(result.items || []);
      
      const countResult = await db.query(
        JOBS_TABLE,
        "gsi_tenant_created",
        "tenant_id = :tenant_id",
        { ":tenant_id": tenantId },
        undefined,
        1000
      );
      const countJobs = filterRunJobs(countResult.items || []);
      totalCount = countJobs.length >= 1000 ? 1000 : countJobs.length;
      lastEvaluatedKey = result.lastEvaluatedKey;
    }

    jobs.sort((a: any, b: any) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });

    const paginatedJobs = includeAll
      ? jobs
      : jobs.slice(offset, offset + pageSize);
    const hasMore = includeAll
      ? false
      : workflowId
        ? offset + pageSize < totalCount
        : Boolean(lastEvaluatedKey);
    
    return {
      jobs: paginatedJobs,
      totalCount,
      hasMore,
      offset,
      limit: includeAll ? totalCount : pageSize,
    };
  }

  async getJob(tenantId: string, jobId: string): Promise<any> {
    const job = await db.get(JOBS_TABLE, { job_id: jobId });

    if (!job) {
      throw new ApiError("This generated lead magnet doesn't exist", 404);
    }

    if (job.tenant_id !== tenantId) {
      throw new ApiError(
        "You don't have permission to access this lead magnet",
        403
      );
    }
    
    await this.enrichJobWithUrls(job);
    return job;
  }
  
  private async enrichJobWithUrls(job: any): Promise<void> {
    if (job.execution_steps_s3_key) {
      try {
        const headCommand = new HeadObjectCommand({
          Bucket: ARTIFACTS_BUCKET,
          Key: job.execution_steps_s3_key,
        });
        await s3Client.send(headCommand);
        
        const executionStepsUrl = await generateExecutionStepsUrl(
          job.execution_steps_s3_key
        );
        if (executionStepsUrl) {
          job.execution_steps_s3_url = executionStepsUrl;
        }
      } catch (error: any) {
        // Log but continue if steps missing
      }
    }
    
    if (
      job.status === "completed" &&
      job.artifacts &&
      Array.isArray(job.artifacts) &&
      job.artifacts.length > 0 &&
      ARTIFACTS_TABLE
    ) {
      // Logic to refresh output_url could go here if needed, separated out
    }
  }
}

export const jobService = new JobService();
