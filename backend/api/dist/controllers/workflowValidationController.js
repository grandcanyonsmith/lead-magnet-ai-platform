"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workflowValidationController = exports.WorkflowValidationController = void 0;
const db_1 = require("../utils/db");
const errors_1 = require("../utils/errors");
const dependencyResolver_1 = require("../utils/dependencyResolver");
const env_1 = require("../utils/env");
const WORKFLOWS_TABLE = env_1.env.workflowsTable;
/**
 * Controller for workflow validation and execution planning.
 * Handles dependency validation and execution plan generation.
 */
class WorkflowValidationController {
    /**
     * Get the execution plan for a workflow.
     * Resolves step dependencies and groups steps by execution order.
     */
    async getExecutionPlan(tenantId, workflowId) {
        const workflow = await db_1.db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });
        if (!workflow || workflow.deleted_at) {
            throw new errors_1.ApiError('This lead magnet doesn\'t exist or has been removed', 404);
        }
        if (workflow.tenant_id !== tenantId) {
            throw new errors_1.ApiError('You don\'t have permission to access this lead magnet', 403);
        }
        const steps = workflow.steps || [];
        if (!steps || steps.length === 0) {
            throw new errors_1.ApiError('Workflow has no steps configured', 400);
        }
        // Resolve execution plan
        const executionPlan = (0, dependencyResolver_1.resolveExecutionGroups)(steps);
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
    async validateDependencies(tenantId, workflowId, body) {
        const workflow = await db_1.db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });
        if (!workflow || workflow.deleted_at) {
            throw new errors_1.ApiError('This lead magnet doesn\'t exist or has been removed', 404);
        }
        if (workflow.tenant_id !== tenantId) {
            throw new errors_1.ApiError('You don\'t have permission to access this lead magnet', 403);
        }
        // Use steps from body if provided, otherwise use workflow steps
        const steps = body.steps || workflow.steps || [];
        if (!steps || steps.length === 0) {
            throw new errors_1.ApiError('No steps provided for validation', 400);
        }
        // Validate dependencies
        const validation = (0, dependencyResolver_1.validateDependencies)(steps);
        return {
            statusCode: 200,
            body: {
                valid: validation.valid,
                errors: validation.errors,
            },
        };
    }
}
exports.WorkflowValidationController = WorkflowValidationController;
exports.workflowValidationController = new WorkflowValidationController();
//# sourceMappingURL=workflowValidationController.js.map