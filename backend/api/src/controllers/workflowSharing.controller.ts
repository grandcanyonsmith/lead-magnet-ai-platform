import { RouteResponse } from '../routes';
import { createSharedArtifactCopies } from '../services/workflowSharingService';
import { logger } from '../utils/logger';

/**
 * Controller for workflow sharing operations
 * Internal endpoints for sharing workflows, jobs, and artifacts
 */
class WorkflowSharingController {
  /**
   * Share an artifact with shared workflows
   * POST /internal/workflow-sharing/share-artifact
   * Called by Python worker after creating an artifact
   */
  async shareArtifact(
    _params: Record<string, string>,
    body: any,
    _query: Record<string, string | undefined>,
    tenantId: string | undefined
  ): Promise<RouteResponse> {
    const { artifact_id, job_id, tenant_id } = body;

    if (!artifact_id || !job_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields: artifact_id and job_id are required',
        }),
      };
    }

    // Use tenant_id from body (for internal calls from worker) or from auth context
    const effectiveTenantId = tenant_id || tenantId;
    if (!effectiveTenantId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing tenant_id',
        }),
      };
    }

    try {
      // Share artifact asynchronously (non-blocking)
      createSharedArtifactCopies(artifact_id, job_id, effectiveTenantId).catch((error: any) => {
        logger.error('[WorkflowSharing] Error sharing artifact', {
          error: error.message,
          artifact_id,
          job_id,
        });
      });

      return {
        statusCode: 202,
        body: JSON.stringify({
          message: 'Artifact sharing initiated',
          artifact_id,
        }),
      };
    } catch (error: any) {
      logger.error('[WorkflowSharing] Error in shareArtifact endpoint', {
        error: error.message,
        artifact_id,
        job_id,
      });
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Failed to initiate artifact sharing',
        }),
      };
    }
  }
}

export const workflowSharingController = new WorkflowSharingController();

