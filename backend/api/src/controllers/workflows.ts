import { ulid } from 'ulid';
import { db } from '../utils/db';
import { validate, createWorkflowSchema, updateWorkflowSchema } from '../utils/validation';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';
import { formService } from '../services/formService';
import { ensureStepDefaults, WorkflowStep } from '../utils/workflowMigration';
import { logger } from '../utils/logger';
import { env } from '../utils/env';

const WORKFLOWS_TABLE = env.workflowsTable;

if (!WORKFLOWS_TABLE) {
  logger.error('[Workflows Controller] WORKFLOWS_TABLE environment variable is not set');
}

class WorkflowsController {
  async list(_tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse> {
    if (!WORKFLOWS_TABLE) {
      throw new ApiError('WORKFLOWS_TABLE environment variable is not configured', 500);
    }

    try {
      const status = queryParams.status;
      const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;
      const offset = queryParams.offset ? parseInt(queryParams.offset) : 0;

      logger.info('[Workflows List] Starting query', { status, limit, offset });

      let workflows: any[] = [];
      try {
        if (status) {
          // Remove tenant_id filtering - show all workflows from all accounts
          const allWorkflows = await db.scan(WORKFLOWS_TABLE!, limit * 10); // Scan more to filter by status
          workflows = allWorkflows.filter((w: any) => w.status === status).slice(0, limit + 1);
        } else {
          // Remove tenant_id filtering - show all workflows from all accounts
          workflows = await db.scan(WORKFLOWS_TABLE!, limit + 1);
        }
      } catch (dbError: any) {
        logger.error('[Workflows List] Database query error', {
          error: dbError.message,
          errorName: dbError.name,
          table: WORKFLOWS_TABLE,
        });
        // Return empty array if table doesn't exist or permissions issue
        if (
          dbError.name === 'ResourceNotFoundException' ||
          dbError.name === 'AccessDeniedException'
        ) {
          workflows = [];
        } else {
          throw dbError;
        }
      }

      // Filter out soft-deleted items
      workflows = workflows.filter((w: any) => !w.deleted_at);

      // Sort by created_at DESC (most recent first)
      workflows.sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA; // DESC order
      });

      // Determine if there are more items
      const hasMore = workflows.length > limit;
      const workflowsToProcess = hasMore ? workflows.slice(0, limit) : workflows;

      // Fetch form data for each workflow, auto-create if missing
      const workflowsWithForms = await Promise.all(
        workflowsToProcess.map(async (workflow: any) => {
          try {
            let activeForm = await formService.getFormForWorkflow(workflow.workflow_id);
            
            // Auto-create form if it doesn't exist
            if (!activeForm && workflow.workflow_name) {
              try {
                logger.info('[Workflows List] Auto-creating form for workflow', {
                  workflowId: workflow.workflow_id,
                  workflowName: workflow.workflow_name,
                });
                await formService.createFormForWorkflow(
                  workflow.tenant_id,
                  workflow.workflow_id,
                  workflow.workflow_name
                );
                
                // Fetch the newly created form
                activeForm = await formService.getFormForWorkflow(workflow.workflow_id);
              } catch (createError) {
                logger.error('[Workflows List] Error auto-creating form', {
                  workflowId: workflow.workflow_id,
                  error: (createError as any).message,
                });
              }
            }
            
            return {
              ...workflow,
              form: activeForm ? {
                form_id: activeForm.form_id,
                form_name: activeForm.form_name,
                public_slug: activeForm.public_slug,
                status: activeForm.status,
              } : null,
            };
          } catch (error) {
            logger.error('[Workflows List] Error fetching form for workflow', {
              workflowId: workflow.workflow_id,
              error: (error as any).message,
            });
            return {
              ...workflow,
              form: null,
            };
          }
        })
      );

      logger.info('[Workflows List] Query completed', {
        workflowsFound: workflowsWithForms.length,
        hasMore,
        offset,
        limit,
      });

      const response = {
        statusCode: 200,
        body: {
          workflows: workflowsWithForms,
          count: workflowsWithForms.length,
          total: workflows.length, // Total before pagination
          limit,
          offset,
          has_more: hasMore,
        },
      };

      logger.info('[Workflows List] Returning response', {
        statusCode: response.statusCode,
        bodyKeys: Object.keys(response.body),
        workflowsCount: response.body.count,
        workflowsLength: response.body.workflows?.length,
      });

      return response;
    } catch (error: any) {
      logger.error('[Workflows List] Error', {
        error: error.message,
        errorName: error.name,
        stack: error.stack,
      });
      throw error;
    }
  }

  async get(_tenantId: string, workflowId: string): Promise<RouteResponse> {
    if (!WORKFLOWS_TABLE) {
      throw new ApiError('WORKFLOWS_TABLE environment variable is not configured', 500);
    }

    const workflow = await db.get(WORKFLOWS_TABLE!, { workflow_id: workflowId });

    if (!workflow || workflow.deleted_at) {
      throw new ApiError('This lead magnet doesn\'t exist or has been removed', 404);
    }

    // Removed tenant_id check - allow access to all workflows from all accounts

    // Log workflow steps count for debugging
    if (workflow.steps) {
      logger.debug(`Workflow ${workflowId} steps count`, {
        stepsCount: Array.isArray(workflow.steps) ? workflow.steps.length : 0,
        stepNames: Array.isArray(workflow.steps) 
          ? workflow.steps.map((s: any, i: number) => ({ index: i, step_name: s.step_name, step_order: s.step_order }))
          : [],
      });
    }

    // Fetch associated form
    const form = await formService.getFormForWorkflow(workflowId);

    return {
      statusCode: 200,
      body: {
        ...workflow,
        form,
      },
    };
  }

  async create(tenantId: string, body: any): Promise<RouteResponse> {
    if (!WORKFLOWS_TABLE) {
      throw new ApiError('WORKFLOWS_TABLE environment variable is not configured', 500);
    }

    const data = validate(createWorkflowSchema, body);

    // All workflows must use steps format
    if (!data.steps || data.steps.length === 0) {
      throw new ApiError(
        'Workflow must have at least one step.',
        400
      );
    }

    // Ensure step_order is set for each step and add defaults for tools/tool_choice/step_description
    const workflowData = {
      ...data,
      steps: ensureStepDefaults(data.steps as any[]) as WorkflowStep[]
    };

    const workflowId = `wf_${ulid()}`;
    const workflow = {
      workflow_id: workflowId,
      tenant_id: tenantId,
      ...workflowData,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.put(WORKFLOWS_TABLE!, workflow);

    // Auto-create form for the workflow
    let formId: string | null = null;
    try {
      formId = await formService.createFormForWorkflow(
        tenantId,
        workflowId,
        data.workflow_name,
        body.form_fields_schema?.fields // Allow form fields to be passed during creation
      );
      
      // Update workflow with form_id
      await db.update(WORKFLOWS_TABLE!, { workflow_id: workflowId }, {
        form_id: formId,
      });
      (workflow as any).form_id = formId;
    } catch (error) {
      logger.error('[Workflows Create] Error creating form for workflow', {
        workflowId,
        error: (error as any).message,
      });
      // Continue even if form creation fails - workflow is still created
    }

    // Fetch the created form to include in response
    const form = formId ? await formService.getFormForWorkflow(workflowId) : null;

    // Create notification for workflow creation
    try {
      const { notificationsController } = await import('./notifications');
      await notificationsController.create(
        tenantId,
        'workflow_created',
        'New lead magnet created',
        `Your lead magnet "${workflowData.workflow_name}" has been created successfully.`,
        workflowId,
        'workflow'
      );
    } catch (error) {
      logger.error('[Workflows Create] Error creating notification', error);
      // Don't fail workflow creation if notification fails
    }

    return {
      statusCode: 201,
      body: {
        ...workflow,
        form,
      },
    };
  }

  async update(_tenantId: string, workflowId: string, body: any): Promise<RouteResponse> {
    if (!WORKFLOWS_TABLE) {
      throw new ApiError('WORKFLOWS_TABLE environment variable is not configured', 500);
    }

    const existing = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });

    if (!existing || existing.deleted_at) {
      throw new ApiError('This lead magnet doesn\'t exist or has been removed', 404);
    }

    // Removed tenant_id check - allow access to all workflows from all accounts

    // Normalize steps BEFORE validation to clean up dependencies
    // This prevents validation errors from invalid dependency indices
    let normalizedBody = { ...body };
    if (normalizedBody.steps && Array.isArray(normalizedBody.steps) && normalizedBody.steps.length > 0) {
      // Clean up dependencies before validation
      normalizedBody.steps = normalizedBody.steps.map((step: any, index: number) => {
        // Ensure step_order is set
        const stepOrder = step.step_order !== undefined ? step.step_order : index;
        
        // Clean up depends_on array
        let dependsOn = step.depends_on;
        if (dependsOn !== undefined && dependsOn !== null && Array.isArray(dependsOn)) {
          dependsOn = dependsOn.filter((depIndex: number) => 
            typeof depIndex === 'number' && 
            depIndex >= 0 && 
            depIndex < normalizedBody.steps.length && 
            depIndex !== index
          );
        }
        
        return {
          ...step,
          step_order: stepOrder,
          depends_on: dependsOn,
        };
      });
    }
    
    const data = validate(updateWorkflowSchema, normalizedBody) as any;

    // Ensure workflow has steps (either existing or in update)
    const hasStepsInUpdate = data.steps !== undefined && data.steps.length > 0;
    const hasExistingSteps = existing.steps && existing.steps.length > 0;
    
    if (!hasStepsInUpdate && !hasExistingSteps) {
      throw new ApiError(
        'Workflow must have at least one step.',
        400
      );
    }
    
    let updateData: any = { ...data };
    
    // If steps are being updated, ensure they have proper defaults
    if (hasStepsInUpdate) {
      updateData.steps = ensureStepDefaults(data.steps);
      logger.debug('[Workflows Update] After ensureStepDefaults', {
        workflowId,
        stepsToSave: updateData.steps?.length || 0,
        stepNames: updateData.steps?.map((s: any) => s.step_name) || [],
      });
    }

    const updated = await db.update(WORKFLOWS_TABLE!, { workflow_id: workflowId }, {
      ...updateData,
      updated_at: new Date().toISOString(),
    });
    
    if (updated) {
      logger.debug('[Workflows Update] After DB update', {
        workflowId,
        savedStepsCount: updated.steps?.length || 0,
        savedStepNames: updated.steps?.map((s: any) => s.step_name) || [],
      });
    }

    // If workflow name changed, update form name
    if (data.workflow_name && data.workflow_name !== existing.workflow_name) {
      try {
        await formService.updateFormName(workflowId, data.workflow_name);
      } catch (error) {
        logger.error('[Workflows Update] Error updating form name', {
          workflowId,
          error: (error as any).message,
        });
      }
    }

    // Fetch updated form to include in response
    const form = await formService.getFormForWorkflow(workflowId);

    return {
      statusCode: 200,
      body: {
        ...updated,
        form,
      },
    };
  }

  async delete(_tenantId: string, workflowId: string): Promise<RouteResponse> {
    if (!WORKFLOWS_TABLE) {
      throw new ApiError('WORKFLOWS_TABLE environment variable is not configured', 500);
    }

    const existing = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });

    if (!existing || existing.deleted_at) {
      throw new ApiError('This lead magnet doesn\'t exist or has been removed', 404);
    }

    // Removed tenant_id check - allow access to all workflows from all accounts

    // Soft delete workflow
    await db.update(WORKFLOWS_TABLE!, { workflow_id: workflowId }, {
      deleted_at: new Date().toISOString(),
    });

    // Cascade delete associated form
    try {
      await formService.deleteFormsForWorkflow(workflowId);
    } catch (error) {
      logger.error('[Workflows Delete] Error deleting associated form', {
        workflowId,
        error: (error as any).message,
      });
      // Continue even if form deletion fails
    }

    return {
      statusCode: 204,
      body: {},
    };
  }
}

export const workflowsController = new WorkflowsController();
