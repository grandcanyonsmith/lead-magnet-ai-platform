import { ulid } from 'ulid';
import { db } from '@utils/db';
import { ApiError } from '@utils/errors';
import { formService } from '@domains/forms/services/formService';
import { ensureStepDefaults, WorkflowStep } from './workflow/workflowConfigSupport';
import { logger } from '@utils/logger';
import { env } from '@utils/env';
import { validate, createWorkflowSchema, updateWorkflowSchema } from '@utils/validation';
import { ToolChoice } from '@utils/types';
import { createWorkflowVersion, resolveWorkflowVersion } from './workflowVersionService';

const WORKFLOWS_TABLE = env.workflowsTable;
const USER_SETTINGS_TABLE = env.userSettingsTable;

if (!WORKFLOWS_TABLE) {
  logger.error('[WorkflowCrudService] WORKFLOWS_TABLE environment variable is not set');
}

async function loadDefaultToolChoice(tenantId: string): Promise<ToolChoice | undefined> {
  if (!USER_SETTINGS_TABLE) return undefined;
  try {
    const settings = await db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId });
    const choice = settings?.default_tool_choice;
    return choice === 'auto' || choice === 'required' || choice === 'none'
      ? choice
      : undefined;
  } catch (error: any) {
    logger.warn('[WorkflowCrudService] Failed to load default tool choice', {
      tenantId,
      error: error?.message || String(error),
    });
    return undefined;
  }
}

async function loadDefaultServiceTier(
  tenantId: string,
): Promise<string | undefined> {
  if (!USER_SETTINGS_TABLE) return undefined;
  try {
    const settings = await db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId });
    const tier = settings?.default_service_tier;
    return tier &&
      ['auto', 'default', 'flex', 'scale', 'priority'].includes(tier)
      ? tier
      : undefined;
  } catch (error: any) {
    logger.warn('[WorkflowCrudService] Failed to load default service tier', {
      tenantId,
      error: error?.message || String(error),
    });
    return undefined;
  }
}

async function loadDefaultTextVerbosity(
  tenantId: string,
): Promise<string | undefined> {
  if (!USER_SETTINGS_TABLE) return undefined;
  try {
    const settings = await db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId });
    const verbosity = settings?.default_text_verbosity;
    return verbosity && ['low', 'medium', 'high'].includes(verbosity)
      ? verbosity
      : undefined;
  } catch (error: any) {
    logger.warn('[WorkflowCrudService] Failed to load default text verbosity', {
      tenantId,
      error: error?.message || String(error),
    });
    return undefined;
  }
}

export class WorkflowCrudService {
  async listWorkflows(tenantId: string, queryParams: Record<string, any>): Promise<{ workflows: any[], count: number }> {
    if (!WORKFLOWS_TABLE) {
      throw new ApiError('WORKFLOWS_TABLE environment variable is not configured', 500);
    }

    try {
      // Status filtering removed as per requirements to simplify workflow states
      // const status = queryParams.status;
      const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;

      logger.info('[Workflows List] Starting query', { tenantId, limit });

      let workflows: any[] = [];
      try {
        // Always query all workflows for tenant
        const result = await db.query(
          WORKFLOWS_TABLE,
          'gsi_tenant_status',
          'tenant_id = :tenant_id',
          { ':tenant_id': tenantId },
          undefined,
          limit
        );
        workflows = result.items;
      } catch (dbError: any) {
        logger.error('[Workflows List] Database query error', {
          error: dbError.message,
          errorName: dbError.name,
          table: WORKFLOWS_TABLE,
          tenantId,
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

      // Fetch form data for each workflow, auto-create if missing
      const workflowsWithForms = await Promise.all(
        workflows.map(async (workflow: any) => {
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
              version: resolveWorkflowVersion(workflow),
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
              version: resolveWorkflowVersion(workflow),
              form: null,
            };
          }
        })
      );

      return {
        workflows: workflowsWithForms,
        count: workflowsWithForms.length,
      };
    } catch (error: any) {
      logger.error('[Workflows List] Error', {
        error: error.message,
        errorName: error.name,
        stack: error.stack,
        tenantId,
      });
      throw error;
    }
  }

  async getWorkflow(tenantId: string, workflowId: string): Promise<any> {
    if (!WORKFLOWS_TABLE) {
      throw new ApiError('WORKFLOWS_TABLE environment variable is not configured', 500);
    }

    const workflow = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });

    if (!workflow || workflow.deleted_at) {
      throw new ApiError('This lead magnet doesn\'t exist or has been removed', 404);
    }

    if (workflow.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this lead magnet', 403);
    }

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
      ...workflow,
      version: resolveWorkflowVersion(workflow),
      form,
    };
  }

  async createWorkflow(tenantId: string, body: any): Promise<any> {
    if (!WORKFLOWS_TABLE) {
      throw new ApiError('WORKFLOWS_TABLE environment variable is not configured', 500);
    }

    const data = validate(createWorkflowSchema, body);

    // All workflows must use steps format
    if (!data.steps || data.steps.length === 0) {
      throw new ApiError(
        'Workflow must have at least one step. Legacy format is no longer supported.',
        400
      );
    }

    // Ensure step_order is set for each step and add defaults for tools/tool_choice/step_description
    const [defaultToolChoice, defaultServiceTier, defaultTextVerbosity] =
      await Promise.all([
        loadDefaultToolChoice(tenantId),
        loadDefaultServiceTier(tenantId),
        loadDefaultTextVerbosity(tenantId),
      ]);
    const workflowData = {
      ...data,
      steps: ensureStepDefaults(data.steps as any[], {
        defaultToolChoice,
        defaultServiceTier,
        defaultTextVerbosity,
      }) as WorkflowStep[]
    };

    const workflowId = `wf_${ulid()}`;
    const workflow = {
      workflow_id: workflowId,
      tenant_id: tenantId,
      ...workflowData,
      version: 1,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.put(WORKFLOWS_TABLE, workflow);
    await createWorkflowVersion(workflow, 1);

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
      await db.update(WORKFLOWS_TABLE, { workflow_id: workflowId }, {
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
      // Dynamic import to avoid circular dependencies if any
      const { notificationsController } = await import('@controllers/notifications');
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
      ...workflow,
      form,
    };
  }

  async updateWorkflow(tenantId: string, workflowId: string, body: any): Promise<any> {
    if (!WORKFLOWS_TABLE) {
      throw new ApiError('WORKFLOWS_TABLE environment variable is not configured', 500);
    }

    const existing = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });

    if (!existing || existing.deleted_at) {
      throw new ApiError('This lead magnet doesn\'t exist or has been removed', 404);
    }

    if (existing.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this lead magnet', 403);
    }

    const currentVersion = resolveWorkflowVersion(existing);
    if (
      typeof existing.version !== "number" ||
      !Number.isFinite(existing.version) ||
      existing.version <= 0
    ) {
      await createWorkflowVersion(existing, currentVersion);
    }

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
        'Workflow must have at least one step. Legacy format is no longer supported.',
        400
      );
    }
    
    let updateData: any = { ...data };
    
    // If steps are being updated, ensure they have proper defaults
    if (hasStepsInUpdate) {
      const [defaultToolChoice, defaultServiceTier, defaultTextVerbosity] =
        await Promise.all([
          loadDefaultToolChoice(tenantId),
          loadDefaultServiceTier(tenantId),
          loadDefaultTextVerbosity(tenantId),
        ]);
      updateData.steps = ensureStepDefaults(data.steps, {
        defaultToolChoice,
        defaultServiceTier,
        defaultTextVerbosity,
      });
      logger.info('[Workflows Update] After ensureStepDefaults', {
        workflowId,
        stepsToSave: updateData.steps?.length || 0,
        stepNames: updateData.steps?.map((s: any) => s.step_name) || [],
      });
    }

    const nextVersion = currentVersion + 1;
    const updated = await db.update(WORKFLOWS_TABLE, { workflow_id: workflowId }, {
      ...updateData,
      version: nextVersion,
      updated_at: new Date().toISOString(),
    });
    await createWorkflowVersion(updated, nextVersion);
    
    if (updated) {
      logger.info('[Workflows Update] After DB update', {
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
      ...updated,
      form,
    };
  }

  async deleteWorkflow(tenantId: string, workflowId: string): Promise<void> {
    if (!WORKFLOWS_TABLE) {
      throw new ApiError('WORKFLOWS_TABLE environment variable is not configured', 500);
    }

    const existing = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });

    if (!existing || existing.deleted_at) {
      throw new ApiError('This lead magnet doesn\'t exist or has been removed', 404);
    }

    if (existing.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this lead magnet', 403);
    }

    // Soft delete workflow
    await db.update(WORKFLOWS_TABLE, { workflow_id: workflowId }, {
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
  }
}

export const workflowCrudService = new WorkflowCrudService();

