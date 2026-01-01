import { db } from "../../utils/db";
import { env } from "../../utils/env";
import { logger } from "../../utils/logger";
import { ApiError } from "../../utils/errors";
import { artifactsController } from "../../controllers/artifacts";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { generateExecutionStepsUrl } from "../../utils/executionStepsUtils";
import { ArtifactUrlService } from "../artifactUrlService";

const JOBS_TABLE = env.jobsTable;
const ARTIFACTS_BUCKET = env.artifactsBucket;
const ARTIFACTS_TABLE = env.artifactsTable;
const SUBMISSIONS_TABLE = env.submissionsTable;

const s3Client = new S3Client({ region: env.awsRegion });

export class JobService {
  async listJobs(
    tenantId: string,
    queryParams: Record<string, any>
  ): Promise<any> {
    const workflowId = queryParams.workflow_id;
    const status = queryParams.status;
    const pageSize = queryParams.limit ? parseInt(queryParams.limit) : 20;
    const offset = queryParams.offset ? parseInt(queryParams.offset) : 0;
    const fetchLimit = pageSize + offset;

    let jobs;
    let totalCount = 0;

    if (workflowId && status) {
      const result = await db.query(
        JOBS_TABLE,
        "gsi_workflow_status",
        "workflow_id = :workflow_id AND #status = :status",
        { ":workflow_id": workflowId, ":status": status },
        { "#status": "status" },
        fetchLimit
      );
      jobs = result.items;
      totalCount = jobs.length;
    } else if (workflowId) {
      const result = await db.query(
        JOBS_TABLE,
        "gsi_workflow_status",
        "workflow_id = :workflow_id",
        { ":workflow_id": workflowId },
        undefined,
        fetchLimit
      );
      jobs = result.items;
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
      jobs = result.items;
      
      const countResult = await db.query(
        JOBS_TABLE,
        "gsi_tenant_created",
        "tenant_id = :tenant_id",
        { ":tenant_id": tenantId },
        undefined,
        1000
      );
      const countJobs = countResult.items;
      totalCount = countJobs.length >= 1000 ? 1000 : countJobs.length;
    }

    jobs.sort((a: any, b: any) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });

    const paginatedJobs = jobs.slice(offset, offset + pageSize);
    const hasMore = jobs.length > offset + pageSize;
    
    return {
      jobs: paginatedJobs,
      totalCount,
      hasMore
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
