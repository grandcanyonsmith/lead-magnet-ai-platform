import { APIGatewayProxyResultV2 } from "aws-lambda";
import { db } from "@utils/db";
import { env } from "@utils/env";
import { workflowAIEditJobService } from "../services/workflowAIEditJobService";

const JOBS_TABLE = env.jobsTable;

/**
 * Handle workflow AI edit job (async Lambda invocation).
 * This is separate from normal API Gateway requests.
 */
export async function handleWorkflowAIEditJob(
  event: any,
): Promise<APIGatewayProxyResultV2> {
  const { job_id, tenant_id, workflow_id, user_prompt, context_job_id } = event;

  let finalTenantId = tenant_id;
  let finalWorkflowId = workflow_id;
  let finalUserPrompt = typeof user_prompt === "string" ? user_prompt : "";
  let finalContextJobId =
    typeof context_job_id === "string" ? context_job_id : undefined;

  if (!finalTenantId || !finalWorkflowId) {
    const job = await db.get(JOBS_TABLE, { job_id });
    if (!job) {
      throw new Error(`Job ${job_id} not found`);
    }
    finalTenantId = finalTenantId || job.tenant_id;
    finalWorkflowId = finalWorkflowId || job.workflow_id;
    finalUserPrompt =
      finalUserPrompt || (typeof job.user_prompt === "string" ? job.user_prompt : "");
    finalContextJobId =
      finalContextJobId ||
      (typeof job.context_job_id === "string" ? job.context_job_id : undefined);
  }

  await workflowAIEditJobService.processWorkflowAIEditJob(
    job_id,
    finalTenantId,
    finalWorkflowId,
    finalUserPrompt,
    finalContextJobId,
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Workflow AI edit job processed" }),
  };
}


