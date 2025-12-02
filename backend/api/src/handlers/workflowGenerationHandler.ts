import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { db } from '../utils/db';
import { env } from '../utils/env';
import { workflowGenerationJobService } from '../services/workflowGenerationJobService';

const JOBS_TABLE = env.jobsTable;

/**
 * Handle workflow generation job (async Lambda invocation).
 * This is separate from normal API Gateway requests.
 */
export async function handleWorkflowGenerationJob(event: any): Promise<APIGatewayProxyResultV2> {
  const { job_id, tenant_id, description, model } = event;

  // Load job data if description/model/tenant_id are missing
  let finalDescription = description;
  let finalModel = model || 'gpt-5';
  let finalTenantId = tenant_id;

  if (!finalDescription || !finalTenantId) {
    const job = await db.get(JOBS_TABLE, { job_id });
    if (!job) {
      throw new Error(`Job ${job_id} not found`);
    }
    finalDescription = finalDescription || job.description;
    finalModel = finalModel || job.model || 'gpt-5';
    finalTenantId = finalTenantId || job.tenant_id;
  }

  await workflowGenerationJobService.processWorkflowGenerationJob(
    job_id,
    finalTenantId,
    finalDescription,
    finalModel
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Workflow generation job processed' }),
  };
}

