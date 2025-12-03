import { db } from '@utils/db';
import { ApiError } from '@utils/errors';
import { RouteResponse } from '@routes/routes';
import { resolveExecutionGroups, validateDependencies } from '@utils/dependencyResolver';
import { env } from '@utils/env';

const WORKFLOWS_TABLE = env.workflowsTable;

/**
 * Controller for workflow validation and execution planning.
 * Handles dependency validation and execution plan generation.
 */
export class WorkflowValidationController {
  /**
   * Get the execution plan for a workflow.
   * Resolves step dependencies and groups steps by execution order.
   */
  async getExecutionPlan(tenantId: string, workflowId: string): Promise<RouteResponse> {
    const workflow = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });

    if (!workflow || workflow.deleted_at) {
      throw new ApiError('This lead magnet doesn\'t exist or has been removed', 404);
    }

    if (workflow.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this lead magnet', 403);
    }

    const steps = workflow.steps || [];
    if (!steps || steps.length === 0) {
      throw new ApiError('Workflow has no steps configured', 400);
    }

    // Resolve execution plan
    const executionPlan = resolveExecutionGroups(steps);

    return {
      statusCode: 200,
      body: {
        workflow_id: workflowId,
        execution_plan: executionPlan,
      },
    };
  }

  /**
   * Validate workflow step dependencies.
   * Checks for circular dependencies and invalid references.
   */
  async validateDependencies(tenantId: string, workflowId: string, body: any): Promise<RouteResponse> {
    const workflow = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });

    if (!workflow || workflow.deleted_at) {
      throw new ApiError('This lead magnet doesn\'t exist or has been removed', 404);
    }

    if (workflow.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this lead magnet', 403);
    }

    // Use steps from body if provided, otherwise use workflow steps
    const steps = body.steps || workflow.steps || [];
    if (!steps || steps.length === 0) {
      throw new ApiError('No steps provided for validation', 400);
    }

    // Validate dependencies
    const validation = validateDependencies(steps);

    return {
      statusCode: 200,
      body: {
        valid: validation.valid,
        errors: validation.errors,
      },
    };
  }
}

export const workflowValidationController = new WorkflowValidationController();

