import { db } from '../utils/db';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';

const JOBS_TABLE = process.env.JOBS_TABLE!;

class JobsController {
  async list(tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse> {
    const workflowId = queryParams.workflow_id;
    const status = queryParams.status;
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;

    let jobs;
    if (workflowId && status) {
      jobs = await db.query(
        JOBS_TABLE,
        'gsi_workflow_status',
        'workflow_id = :workflow_id AND #status = :status',
        { ':workflow_id': workflowId, ':status': status },
        { '#status': 'status' },
        limit
      );
    } else if (workflowId) {
      jobs = await db.query(
        JOBS_TABLE,
        'gsi_workflow_status',
        'workflow_id = :workflow_id',
        { ':workflow_id': workflowId },
        undefined,
        limit
      );
    } else {
      jobs = await db.query(
        JOBS_TABLE,
        'gsi_tenant_created',
        'tenant_id = :tenant_id',
        { ':tenant_id': tenantId },
        undefined,
        limit
      );
    }

    return {
      statusCode: 200,
      body: {
        jobs,
        count: jobs.length,
      },
    };
  }

  async get(tenantId: string, jobId: string): Promise<RouteResponse> {
    const job = await db.get(JOBS_TABLE, { job_id: jobId });

    if (!job) {
      throw new ApiError('Job not found', 404);
    }

    if (job.tenant_id !== tenantId) {
      throw new ApiError('Unauthorized', 403);
    }

    return {
      statusCode: 200,
      body: job,
    };
  }
}

export const jobsController = new JobsController();

