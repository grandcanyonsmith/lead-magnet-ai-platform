"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.workflowsController = void 0;
const ulid_1 = require("ulid");
const db_1 = require("../utils/db");
const validation_1 = require("../utils/validation");
const errors_1 = require("../utils/errors");
const formService_1 = require("../services/formService");
const workflowMigration_1 = require("../utils/workflowMigration");
const logger_1 = require("../utils/logger");
const env_1 = require("../utils/env");
const WORKFLOWS_TABLE = env_1.env.workflowsTable;
if (!WORKFLOWS_TABLE) {
    logger_1.logger.error('[Workflows Controller] WORKFLOWS_TABLE environment variable is not set');
}
class WorkflowsController {
    async list(_tenantId, queryParams) {
        if (!WORKFLOWS_TABLE) {
            throw new errors_1.ApiError('WORKFLOWS_TABLE environment variable is not configured', 500);
        }
        try {
            const status = queryParams.status;
            const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;
            const offset = queryParams.offset ? parseInt(queryParams.offset) : 0;
            logger_1.logger.info('[Workflows List] Starting query', { status, limit, offset });
            let workflows = [];
            try {
                if (status) {
                    // Remove tenant_id filtering - show all workflows from all accounts
                    const allWorkflows = await db_1.db.scan(WORKFLOWS_TABLE, limit * 10); // Scan more to filter by status
                    workflows = allWorkflows.filter((w) => w.status === status).slice(0, limit + 1);
                }
                else {
                    // Remove tenant_id filtering - show all workflows from all accounts
                    workflows = await db_1.db.scan(WORKFLOWS_TABLE, limit + 1);
                }
            }
            catch (dbError) {
                logger_1.logger.error('[Workflows List] Database query error', {
                    error: dbError.message,
                    errorName: dbError.name,
                    table: WORKFLOWS_TABLE,
                });
                // Return empty array if table doesn't exist or permissions issue
                if (dbError.name === 'ResourceNotFoundException' ||
                    dbError.name === 'AccessDeniedException') {
                    workflows = [];
                }
                else {
                    throw dbError;
                }
            }
            // Filter out soft-deleted items
            workflows = workflows.filter((w) => !w.deleted_at);
            // Sort by created_at DESC (most recent first)
            workflows.sort((a, b) => {
                const dateA = new Date(a.created_at || 0).getTime();
                const dateB = new Date(b.created_at || 0).getTime();
                return dateB - dateA; // DESC order
            });
            // Determine if there are more items
            const hasMore = workflows.length > limit;
            const workflowsToProcess = hasMore ? workflows.slice(0, limit) : workflows;
            // Fetch form data for each workflow, auto-create if missing
            const workflowsWithForms = await Promise.all(workflowsToProcess.map(async (workflow) => {
                try {
                    let activeForm = await formService_1.formService.getFormForWorkflow(workflow.workflow_id);
                    // Auto-create form if it doesn't exist
                    if (!activeForm && workflow.workflow_name) {
                        try {
                            logger_1.logger.info('[Workflows List] Auto-creating form for workflow', {
                                workflowId: workflow.workflow_id,
                                workflowName: workflow.workflow_name,
                            });
                            await formService_1.formService.createFormForWorkflow(workflow.tenant_id, workflow.workflow_id, workflow.workflow_name);
                            // Fetch the newly created form
                            activeForm = await formService_1.formService.getFormForWorkflow(workflow.workflow_id);
                        }
                        catch (createError) {
                            logger_1.logger.error('[Workflows List] Error auto-creating form', {
                                workflowId: workflow.workflow_id,
                                error: createError.message,
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
                }
                catch (error) {
                    logger_1.logger.error('[Workflows List] Error fetching form for workflow', {
                        workflowId: workflow.workflow_id,
                        error: error.message,
                    });
                    return {
                        ...workflow,
                        form: null,
                    };
                }
            }));
            logger_1.logger.info('[Workflows List] Query completed', {
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
            logger_1.logger.info('[Workflows List] Returning response', {
                statusCode: response.statusCode,
                bodyKeys: Object.keys(response.body),
                workflowsCount: response.body.count,
                workflowsLength: response.body.workflows?.length,
            });
            return response;
        }
        catch (error) {
            logger_1.logger.error('[Workflows List] Error', {
                error: error.message,
                errorName: error.name,
                stack: error.stack,
            });
            throw error;
        }
    }
    async get(_tenantId, workflowId) {
        if (!WORKFLOWS_TABLE) {
            throw new errors_1.ApiError('WORKFLOWS_TABLE environment variable is not configured', 500);
        }
        const workflow = await db_1.db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });
        if (!workflow || workflow.deleted_at) {
            throw new errors_1.ApiError('This lead magnet doesn\'t exist or has been removed', 404);
        }
        // Removed tenant_id check - allow access to all workflows from all accounts
        // Log workflow steps count for debugging
        if (workflow.steps) {
            logger_1.logger.debug(`Workflow ${workflowId} steps count`, {
                stepsCount: Array.isArray(workflow.steps) ? workflow.steps.length : 0,
                stepNames: Array.isArray(workflow.steps)
                    ? workflow.steps.map((s, i) => ({ index: i, step_name: s.step_name, step_order: s.step_order }))
                    : [],
            });
        }
        // Fetch associated form
        const form = await formService_1.formService.getFormForWorkflow(workflowId);
        return {
            statusCode: 200,
            body: {
                ...workflow,
                form,
            },
        };
    }
    async create(tenantId, body) {
        if (!WORKFLOWS_TABLE) {
            throw new errors_1.ApiError('WORKFLOWS_TABLE environment variable is not configured', 500);
        }
        const data = (0, validation_1.validate)(validation_1.createWorkflowSchema, body);
        // All workflows must use steps format
        if (!data.steps || data.steps.length === 0) {
            throw new errors_1.ApiError('Workflow must have at least one step.', 400);
        }
        // Ensure step_order is set for each step and add defaults for tools/tool_choice/step_description
        const workflowData = {
            ...data,
            steps: (0, workflowMigration_1.ensureStepDefaults)(data.steps)
        };
        const workflowId = `wf_${(0, ulid_1.ulid)()}`;
        const workflow = {
            workflow_id: workflowId,
            tenant_id: tenantId,
            ...workflowData,
            status: 'draft',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        await db_1.db.put(WORKFLOWS_TABLE, workflow);
        // Auto-create form for the workflow
        let formId = null;
        try {
            formId = await formService_1.formService.createFormForWorkflow(tenantId, workflowId, data.workflow_name, body.form_fields_schema?.fields // Allow form fields to be passed during creation
            );
            // Update workflow with form_id
            await db_1.db.update(WORKFLOWS_TABLE, { workflow_id: workflowId }, {
                form_id: formId,
            });
            workflow.form_id = formId;
        }
        catch (error) {
            logger_1.logger.error('[Workflows Create] Error creating form for workflow', {
                workflowId,
                error: error.message,
            });
            // Continue even if form creation fails - workflow is still created
        }
        // Fetch the created form to include in response
        const form = formId ? await formService_1.formService.getFormForWorkflow(workflowId) : null;
        // Create notification for workflow creation
        try {
            const { notificationsController } = await Promise.resolve().then(() => __importStar(require('./notifications')));
            await notificationsController.create(tenantId, 'workflow_created', 'New lead magnet created', `Your lead magnet "${workflowData.workflow_name}" has been created successfully.`, workflowId, 'workflow');
        }
        catch (error) {
            logger_1.logger.error('[Workflows Create] Error creating notification', error);
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
    async update(_tenantId, workflowId, body) {
        if (!WORKFLOWS_TABLE) {
            throw new errors_1.ApiError('WORKFLOWS_TABLE environment variable is not configured', 500);
        }
        const existing = await db_1.db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });
        if (!existing || existing.deleted_at) {
            throw new errors_1.ApiError('This lead magnet doesn\'t exist or has been removed', 404);
        }
        // Removed tenant_id check - allow access to all workflows from all accounts
        // Normalize steps BEFORE validation to clean up dependencies
        // This prevents validation errors from invalid dependency indices
        let normalizedBody = { ...body };
        if (normalizedBody.steps && Array.isArray(normalizedBody.steps) && normalizedBody.steps.length > 0) {
            // Clean up dependencies before validation
            normalizedBody.steps = normalizedBody.steps.map((step, index) => {
                // Ensure step_order is set
                const stepOrder = step.step_order !== undefined ? step.step_order : index;
                // Clean up depends_on array
                let dependsOn = step.depends_on;
                if (dependsOn !== undefined && dependsOn !== null && Array.isArray(dependsOn)) {
                    dependsOn = dependsOn.filter((depIndex) => typeof depIndex === 'number' &&
                        depIndex >= 0 &&
                        depIndex < normalizedBody.steps.length &&
                        depIndex !== index);
                }
                return {
                    ...step,
                    step_order: stepOrder,
                    depends_on: dependsOn,
                };
            });
        }
        const data = (0, validation_1.validate)(validation_1.updateWorkflowSchema, normalizedBody);
        // Ensure workflow has steps (either existing or in update)
        const hasStepsInUpdate = data.steps !== undefined && data.steps.length > 0;
        const hasExistingSteps = existing.steps && existing.steps.length > 0;
        if (!hasStepsInUpdate && !hasExistingSteps) {
            throw new errors_1.ApiError('Workflow must have at least one step.', 400);
        }
        let updateData = { ...data };
        // If steps are being updated, ensure they have proper defaults
        if (hasStepsInUpdate) {
            updateData.steps = (0, workflowMigration_1.ensureStepDefaults)(data.steps);
            logger_1.logger.debug('[Workflows Update] After ensureStepDefaults', {
                workflowId,
                stepsToSave: updateData.steps?.length || 0,
                stepNames: updateData.steps?.map((s) => s.step_name) || [],
            });
        }
        const updated = await db_1.db.update(WORKFLOWS_TABLE, { workflow_id: workflowId }, {
            ...updateData,
            updated_at: new Date().toISOString(),
        });
        if (updated) {
            logger_1.logger.debug('[Workflows Update] After DB update', {
                workflowId,
                savedStepsCount: updated.steps?.length || 0,
                savedStepNames: updated.steps?.map((s) => s.step_name) || [],
            });
        }
        // If workflow name changed, update form name
        if (data.workflow_name && data.workflow_name !== existing.workflow_name) {
            try {
                await formService_1.formService.updateFormName(workflowId, data.workflow_name);
            }
            catch (error) {
                logger_1.logger.error('[Workflows Update] Error updating form name', {
                    workflowId,
                    error: error.message,
                });
            }
        }
        // Fetch updated form to include in response
        const form = await formService_1.formService.getFormForWorkflow(workflowId);
        return {
            statusCode: 200,
            body: {
                ...updated,
                form,
            },
        };
    }
    async delete(_tenantId, workflowId) {
        if (!WORKFLOWS_TABLE) {
            throw new errors_1.ApiError('WORKFLOWS_TABLE environment variable is not configured', 500);
        }
        const existing = await db_1.db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });
        if (!existing || existing.deleted_at) {
            throw new errors_1.ApiError('This lead magnet doesn\'t exist or has been removed', 404);
        }
        // Removed tenant_id check - allow access to all workflows from all accounts
        // Soft delete workflow
        await db_1.db.update(WORKFLOWS_TABLE, { workflow_id: workflowId }, {
            deleted_at: new Date().toISOString(),
        });
        // Cascade delete associated form
        try {
            await formService_1.formService.deleteFormsForWorkflow(workflowId);
        }
        catch (error) {
            logger_1.logger.error('[Workflows Delete] Error deleting associated form', {
                workflowId,
                error: error.message,
            });
            // Continue even if form deletion fails
        }
        return {
            statusCode: 204,
            body: {},
        };
    }
}
exports.workflowsController = new WorkflowsController();
//# sourceMappingURL=workflows.js.map