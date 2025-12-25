/**
 * Service for handling workflow sharing between customers
 * Automatically creates shared copies of jobs, submissions, and artifacts when they're created for shared workflows
 */

import { db } from "../utils/db";
import { logger } from "../utils/logger";
import { env } from "../utils/env";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid";

const WORKFLOWS_TABLE = env.workflowsTable;
const JOBS_TABLE = env.jobsTable;
const ARTIFACTS_TABLE = env.artifactsTable;
const SUBMISSIONS_TABLE = env.submissionsTable;

const dynamoClient = new DynamoDBClient({ region: env.awsRegion });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Check if a workflow has shared copies and create shared job copies
 */
export async function createSharedJobCopies(
  originalJobId: string,
  workflowId: string,
  tenantId: string,
  submissionId: string,
): Promise<void> {
  try {
    // Get the original workflow to find its template_id
    const originalWorkflow = await db.get(WORKFLOWS_TABLE!, {
      workflow_id: workflowId,
    });
    if (!originalWorkflow || !originalWorkflow.template_id) {
      // No template_id means we can't find shared copies
      return;
    }

    // Find all shared workflow copies (workflows with same template_id but different tenant_id)
    const workflowsScan = await docClient.send(
      new ScanCommand({
        TableName: WORKFLOWS_TABLE!,
        FilterExpression: "template_id = :tid AND tenant_id <> :tid2",
        ExpressionAttributeValues: {
          ":tid": originalWorkflow.template_id,
          ":tid2": tenantId,
        },
      }),
    );

    const sharedWorkflows = workflowsScan.Items || [];
    if (sharedWorkflows.length === 0) {
      // No shared workflows found
      return;
    }

    // Get the original job
    const originalJob = await db.get(JOBS_TABLE!, { job_id: originalJobId });
    if (!originalJob) {
      logger.warn("[WorkflowSharing] Original job not found", {
        originalJobId,
      });
      return;
    }

    logger.info("[WorkflowSharing] Found shared workflows", {
      originalWorkflowId: workflowId,
      sharedWorkflowCount: sharedWorkflows.length,
    });

    // Create shared job copies for each shared workflow
    const now = new Date().toISOString();
    for (const sharedWorkflow of sharedWorkflows) {
      try {
        // Check if job already exists for this shared workflow
        const existingJobScan = await docClient.send(
          new ScanCommand({
            TableName: JOBS_TABLE!,
            FilterExpression: "workflow_id = :wid AND submission_id = :sid",
            ExpressionAttributeValues: {
              ":wid": sharedWorkflow.workflow_id,
              ":sid": submissionId,
            },
            Limit: 1,
          }),
        );

        if (existingJobScan.Items && existingJobScan.Items.length > 0) {
          // Job already exists, skip
          logger.debug(
            "[WorkflowSharing] Job already exists for shared workflow",
            {
              sharedWorkflowId: sharedWorkflow.workflow_id,
              submissionId,
            },
          );
          continue;
        }

        // Create shared job copy
        const sharedJobId = `job_${ulid()}`;
        const sharedJob = {
          ...originalJob,
          job_id: sharedJobId,
          workflow_id: sharedWorkflow.workflow_id,
          tenant_id: sharedWorkflow.tenant_id,
          created_at: originalJob.created_at || now,
          updated_at: now,
        };

        // Remove any fields that shouldn't be copied
        delete (sharedJob as any).deleted_at;

        await docClient.send(
          new PutCommand({
            TableName: JOBS_TABLE!,
            Item: sharedJob,
          }),
        );

        logger.info("[WorkflowSharing] Created shared job copy", {
          originalJobId,
          sharedJobId,
          sharedWorkflowId: sharedWorkflow.workflow_id,
          sharedTenantId: sharedWorkflow.tenant_id,
        });

        // Create shared submission copy for this shared job
        await createSharedSubmissionCopy(
          submissionId,
          sharedJobId,
          sharedWorkflow.workflow_id,
          sharedWorkflow.tenant_id,
          sharedWorkflow.form_id,
        );
      } catch (error: any) {
        logger.error("[WorkflowSharing] Error creating shared job copy", {
          error: error.message,
          sharedWorkflowId: sharedWorkflow.workflow_id,
          originalJobId,
        });
        // Continue with other shared workflows even if one fails
      }
    }
  } catch (error: any) {
    // Don't fail the original job creation if sharing fails
    logger.error("[WorkflowSharing] Error in createSharedJobCopies", {
      error: error.message,
      originalJobId,
      workflowId,
    });
  }
}

/**
 * Create a shared submission copy for a shared job
 * When a job is shared, we also need to share the submission it references
 */
async function createSharedSubmissionCopy(
  originalSubmissionId: string,
  sharedJobId: string,
  sharedWorkflowId: string,
  sharedTenantId: string,
  sharedFormId?: string,
): Promise<void> {
  try {
    if (!SUBMISSIONS_TABLE) {
      logger.warn(
        "[WorkflowSharing] SUBMISSIONS_TABLE not configured, skipping submission sharing",
      );
      return;
    }

    // Get the original submission
    const originalSubmission = await db.get(SUBMISSIONS_TABLE, {
      submission_id: originalSubmissionId,
    });
    if (!originalSubmission) {
      logger.warn("[WorkflowSharing] Original submission not found", {
        originalSubmissionId,
      });
      return;
    }

    // Check if shared submission already exists
    const existingSubmissionScan = await docClient.send(
      new ScanCommand({
        TableName: SUBMISSIONS_TABLE,
        FilterExpression:
          "tenant_id = :tid AND workflow_id = :wid AND submitter_email = :email AND created_at = :created",
        ExpressionAttributeValues: {
          ":tid": sharedTenantId,
          ":wid": sharedWorkflowId,
          ":email": originalSubmission.submitter_email,
          ":created": originalSubmission.created_at,
        },
        Limit: 1,
      }),
    );

    if (
      existingSubmissionScan.Items &&
      existingSubmissionScan.Items.length > 0
    ) {
      // Submission already exists, update the shared job to reference it
      const existingSharedSubmission = existingSubmissionScan.Items[0];
      const now = new Date().toISOString();
      await docClient.send(
        new UpdateCommand({
          TableName: JOBS_TABLE!,
          Key: { job_id: sharedJobId },
          UpdateExpression: "SET submission_id = :sid, updated_at = :updated",
          ExpressionAttributeValues: {
            ":sid": existingSharedSubmission.submission_id,
            ":updated": now,
          },
        }),
      );
      logger.debug(
        "[WorkflowSharing] Shared submission already exists, updated job reference",
        {
          sharedJobId,
          sharedSubmissionId: existingSharedSubmission.submission_id,
        },
      );
      return;
    }

    // Create shared submission copy
    const sharedSubmissionId = `sub_${ulid()}`;
    const now = new Date().toISOString();
    const sharedSubmission = {
      ...originalSubmission,
      submission_id: sharedSubmissionId,
      tenant_id: sharedTenantId,
      workflow_id: sharedWorkflowId,
      form_id: sharedFormId || originalSubmission.form_id,
      job_id: sharedJobId,
      created_at: originalSubmission.created_at || now,
      ttl: originalSubmission.ttl,
    };

    // Remove any fields that shouldn't be copied
    delete (sharedSubmission as any).deleted_at;

    await docClient.send(
      new PutCommand({
        TableName: SUBMISSIONS_TABLE,
        Item: sharedSubmission,
      }),
    );

    // Update shared job to reference the new submission_id
    await docClient.send(
      new UpdateCommand({
        TableName: JOBS_TABLE!,
        Key: { job_id: sharedJobId },
        UpdateExpression: "SET submission_id = :sid, updated_at = :updated",
        ExpressionAttributeValues: {
          ":sid": sharedSubmissionId,
          ":updated": now,
        },
      }),
    );

    logger.info("[WorkflowSharing] Created shared submission copy", {
      originalSubmissionId,
      sharedSubmissionId,
      sharedJobId,
      sharedWorkflowId,
      sharedTenantId,
    });
  } catch (error: any) {
    // Don't fail the job sharing if submission sharing fails
    logger.error("[WorkflowSharing] Error creating shared submission copy", {
      error: error.message,
      originalSubmissionId,
      sharedJobId,
    });
  }
}

/**
 * Create shared artifact copies for shared jobs
 * When an artifact is created for a job, this creates copies for all shared job copies
 */
export async function createSharedArtifactCopies(
  originalArtifactId: string,
  jobId: string,
  tenantId: string,
): Promise<void> {
  try {
    if (!ARTIFACTS_TABLE) {
      logger.warn(
        "[WorkflowSharing] ARTIFACTS_TABLE not configured, skipping artifact sharing",
      );
      return;
    }

    // Get the original artifact
    const originalArtifact = await db.get(ARTIFACTS_TABLE, {
      artifact_id: originalArtifactId,
    });
    if (!originalArtifact) {
      logger.warn("[WorkflowSharing] Original artifact not found", {
        originalArtifactId,
      });
      return;
    }

    // Get the original job to find its workflow
    const originalJob = await db.get(JOBS_TABLE!, { job_id: jobId });
    if (!originalJob || !originalJob.workflow_id) {
      logger.warn(
        "[WorkflowSharing] Original job not found or missing workflow_id",
        { jobId },
      );
      return;
    }

    // Get the workflow to find its template_id
    const originalWorkflow = await db.get(WORKFLOWS_TABLE!, {
      workflow_id: originalJob.workflow_id,
    });
    if (!originalWorkflow || !originalWorkflow.template_id) {
      return;
    }

    // Find all shared workflows (same template_id, different tenant_id)
    const workflowsScan = await docClient.send(
      new ScanCommand({
        TableName: WORKFLOWS_TABLE!,
        FilterExpression: "template_id = :tid AND tenant_id <> :tid2",
        ExpressionAttributeValues: {
          ":tid": originalWorkflow.template_id,
          ":tid2": tenantId,
        },
      }),
    );

    const sharedWorkflows = workflowsScan.Items || [];
    if (sharedWorkflows.length === 0) {
      return;
    }

    // For each shared workflow, find the corresponding shared job
    const now = new Date().toISOString();
    for (const sharedWorkflow of sharedWorkflows) {
      try {
        // Find shared job with same submission_id
        const sharedJobsScan = await docClient.send(
          new ScanCommand({
            TableName: JOBS_TABLE!,
            FilterExpression: "workflow_id = :wid AND submission_id = :sid",
            ExpressionAttributeValues: {
              ":wid": sharedWorkflow.workflow_id,
              ":sid": originalJob.submission_id,
            },
            Limit: 1,
          }),
        );

        const sharedJob = sharedJobsScan.Items?.[0];
        if (!sharedJob) {
          // Shared job doesn't exist yet, skip
          continue;
        }

        // Check if artifact already exists for shared job
        const existingArtifactScan = await docClient.send(
          new ScanCommand({
            TableName: ARTIFACTS_TABLE,
            FilterExpression: "job_id = :jid AND artifact_name = :aname",
            ExpressionAttributeValues: {
              ":jid": sharedJob.job_id,
              ":aname": originalArtifact.artifact_name,
            },
            Limit: 1,
          }),
        );

        if (
          existingArtifactScan.Items &&
          existingArtifactScan.Items.length > 0
        ) {
          // Artifact already exists, skip
          continue;
        }

        // Create shared artifact copy pointing to the same S3 file
        const sharedArtifactId = `art_${ulid()}`;
        const sharedArtifact = {
          ...originalArtifact,
          artifact_id: sharedArtifactId,
          job_id: sharedJob.job_id,
          tenant_id: sharedWorkflow.tenant_id,
          // Keep the same S3 key/URL so both artifacts point to the same file
          s3_key: originalArtifact.s3_key,
          s3_url: originalArtifact.s3_url,
          public_url: originalArtifact.public_url,
          created_at: originalArtifact.created_at || now,
        };

        await docClient.send(
          new PutCommand({
            TableName: ARTIFACTS_TABLE,
            Item: sharedArtifact,
          }),
        );

        logger.info("[WorkflowSharing] Created shared artifact copy", {
          originalArtifactId,
          sharedArtifactId,
          originalJobId: jobId,
          sharedJobId: sharedJob.job_id,
          sharedTenantId: sharedWorkflow.tenant_id,
        });
      } catch (error: any) {
        logger.error("[WorkflowSharing] Error creating shared artifact copy", {
          error: error.message,
          sharedWorkflowId: sharedWorkflow.workflow_id,
          originalArtifactId,
        });
        // Continue with other shared workflows even if one fails
      }
    }
  } catch (error: any) {
    // Don't fail the original artifact creation if sharing fails
    logger.error("[WorkflowSharing] Error in createSharedArtifactCopies", {
      error: error.message,
      originalArtifactId,
      jobId,
    });
  }
}
