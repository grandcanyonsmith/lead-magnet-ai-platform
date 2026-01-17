import { ulid } from "ulid";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { db, normalizeQueryResult } from "../utils/db";
import { validate, webhookRequestSchema } from "../utils/validation";
import { ApiError } from "../utils/errors";
import { RouteResponse } from "../routes";
import { logger } from "../utils/logger";
import { processJobLocally } from "../services/jobProcessor";
import { env } from "../utils/env";
import { webhookLogService } from "../services/webhookLogService";
import { resolveWorkflowVersion } from "@domains/workflows/services/workflowVersionService";

const USER_SETTINGS_TABLE = env.userSettingsTable;
const WORKFLOWS_TABLE = env.workflowsTable;
const SUBMISSIONS_TABLE = env.submissionsTable;
const JOBS_TABLE = env.jobsTable;
const STEP_FUNCTIONS_ARN = env.stepFunctionsArn;

const sfnClient = new SFNClient({ region: env.awsRegion });

class WebhooksController {
  /**
   * Handle incoming webhook POST request
   * Looks up user by token, finds workflow, creates submission/job, and triggers execution
   */
  async handleWebhook(
    token: string,
    body: any,
    sourceIp: string,
    headers?: Record<string, string | undefined>,
  ): Promise<RouteResponse> {
    const startTime = Date.now();
    const endpoint = "/v1/webhooks/:token";
    let tenantId: string | null = null;
    let response: RouteResponse | null = null;
    let error: any = null;

    logger.info("[Webhooks] Handling webhook request", {
      token,
      hasBody: !!body,
    });

    try {
      // Look up user_settings by webhook_token
      // Since we don't have a GSI on webhook_token, we'll need to scan or query
      // For MVP, we'll scan the user_settings table (acceptable for low volume)
      const userSettings = await this.findUserByWebhookToken(token);

      if (!userSettings) {
        throw new ApiError("Invalid webhook token", 404);
      }

      tenantId = userSettings.tenant_id;
      logger.info("[Webhooks] Found user for token", { tenantId });

      // Validate request body
      const validatedBody = validate(webhookRequestSchema, body);

      // Find workflow by workflow_id or workflow_name
      let workflow;
      if (validatedBody.workflow_id) {
        workflow = await db.get(WORKFLOWS_TABLE, {
          workflow_id: validatedBody.workflow_id,
        });

        if (!workflow || workflow.deleted_at) {
          throw new ApiError("Workflow not found", 404);
        }

        if (workflow.tenant_id !== tenantId) {
          throw new ApiError(
            "You don't have permission to access this workflow",
            403,
          );
        }
      } else if (validatedBody.workflow_name) {
        // Query workflows by tenant_id and workflow_name
        const workflowsResult = await db.query(
          WORKFLOWS_TABLE,
          "gsi_tenant_status",
          "tenant_id = :tenant_id",
          { ":tenant_id": tenantId },
        );
        const workflows = normalizeQueryResult(workflowsResult);

        workflow = workflows.find(
          (w: any) =>
            w.workflow_name === validatedBody.workflow_name && !w.deleted_at,
        );

        if (!workflow) {
          throw new ApiError("Workflow not found", 404);
        }
      } else {
        throw new ApiError(
          "Either workflow_id or workflow_name is required",
          400,
        );
      }

      logger.info("[Webhooks] Found workflow", {
        workflowId: workflow.workflow_id,
      });

      // Extract form data (accept any structure)
      const formData =
        validatedBody.form_data || validatedBody.submission_data || {};

      // Ensure name, email, and phone are present (required by submission schema)
      // If not provided, use defaults
      const submissionData = {
        name: formData.name || "Webhook Submission",
        email: formData.email || "webhook@example.com",
        phone: formData.phone || "",
        ...formData, // Include all other form data
      };

      // Create submission record
      const submissionId = `sub_${ulid()}`;
      const submission: any = {
        submission_id: submissionId,
        tenant_id: tenantId,
        workflow_id: workflow.workflow_id,
        submission_data: submissionData,
        submitter_ip: sourceIp,
        submitter_email: submissionData.email || null,
        submitter_phone: submissionData.phone || null,
        submitter_name: submissionData.name || null,
        created_at: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 days
      };

      // Only include form_id if it exists (DynamoDB GSI doesn't allow null for index keys)
      if (workflow.form_id) {
        submission.form_id = workflow.form_id;
      }

      await db.put(SUBMISSIONS_TABLE, submission);

      // Create job record
      const jobId = `job_${ulid()}`;
      const apiUrl = (env.apiGatewayUrl || env.apiUrl || "").replace(/\/$/, "");
      const job = {
        job_id: jobId,
        tenant_id: tenantId,
        workflow_id: workflow.workflow_id,
        workflow_version: resolveWorkflowVersion(workflow),
        submission_id: submissionId,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(apiUrl ? { api_url: apiUrl } : {}),
      };

      await db.put(JOBS_TABLE, job);

      // Update submission with job_id
      await db.update(
        SUBMISSIONS_TABLE,
        { submission_id: submissionId },
        { job_id: jobId },
      );

      // Create shared job copies for shared workflows (non-blocking)
      const { createSharedJobCopies } =
        await import("../services/workflowSharingService");
      createSharedJobCopies(
        jobId,
        workflow.workflow_id,
        tenantId || "",
        submissionId,
      ).catch((error: any) => {
        logger.error("[Webhooks] Error creating shared job copies", {
          error: error.message,
          jobId,
          workflowId: workflow.workflow_id,
        });
      });

      // Trigger workflow execution (same logic as form submission)
      try {
        if (env.isDevelopment() || !STEP_FUNCTIONS_ARN) {
          logger.info(
            "[Webhooks] Local mode detected, processing job directly",
            { jobId },
          );

          setImmediate(async () => {
            try {
              await processJobLocally(
                jobId,
                tenantId || "",
                workflow.workflow_id,
                submissionId,
              );
            } catch (error: any) {
              logger.error("[Webhooks] Error processing job in local mode", {
                jobId,
                error: error.message,
                errorStack: error.stack,
              });
              await db.update(
                JOBS_TABLE,
                { job_id: jobId },
                {
                  status: "failed",
                  error_message: `Processing failed: ${error.message}`,
                  updated_at: new Date().toISOString(),
                },
              );
            }
          });
        } else {
          const command = new StartExecutionCommand({
            stateMachineArn: STEP_FUNCTIONS_ARN,
            input: JSON.stringify({
              job_id: jobId,
              workflow_id: workflow.workflow_id,
              submission_id: submissionId,
              tenant_id: tenantId,
            }),
          });

          await sfnClient.send(command);
          logger.info("[Webhooks] Started Step Functions execution", {
            jobId,
            workflowId: workflow.workflow_id,
          });
        }
      } catch (error: any) {
        logger.error("[Webhooks] Failed to start job processing", {
          error: error.message,
          errorStack: error.stack,
          jobId,
        });
        await db.update(
          JOBS_TABLE,
          { job_id: jobId },
          {
            status: "failed",
            error_message: `Failed to start processing: ${error.message}`,
            updated_at: new Date().toISOString(),
          },
        );
        throw new ApiError(
          `Failed to start job processing: ${error.message}`,
          500,
        );
      }

      response = {
        statusCode: 202,
        body: {
          message: "Webhook received and job processing started",
          job_id: jobId,
          status: "pending",
        },
      };

      return response;
    } catch (err: any) {
      error = err;
      const processingTime = Date.now() - startTime;

      // Log error
      await webhookLogService.logWebhookRequest({
        tenant_id: tenantId,
        webhook_token: token,
        endpoint,
        request_body: body,
        request_headers: headers,
        source_ip: sourceIp,
        response_status: err.statusCode || 500,
        response_body: { error: err.message },
        error_message: err.message,
        error_stack: err.stack,
        processing_time_ms: processingTime,
      });

      throw err;
    } finally {
      // Log successful response
      if (!error && response) {
        const processingTime = Date.now() - startTime;
        await webhookLogService.logWebhookRequest({
          tenant_id: tenantId,
          webhook_token: token,
          endpoint,
          request_body: body,
          request_headers: headers,
          source_ip: sourceIp,
          response_status: response.statusCode,
          response_body: response.body,
          processing_time_ms: processingTime,
        });
      }
    }
  }

  /**
   * Find user_settings by webhook_token
   * Scans the user_settings table to find matching token
   */
  private async findUserByWebhookToken(token: string): Promise<any> {
    // Scan user_settings table for matching webhook_token
    // Note: This is acceptable for MVP with low volume
    // For production at scale, consider adding a GSI on webhook_token
    const items = await db.scan(USER_SETTINGS_TABLE);

    return items.find((item: any) => item.webhook_token === token);
  }
}

export const webhooksController = new WebhooksController();
