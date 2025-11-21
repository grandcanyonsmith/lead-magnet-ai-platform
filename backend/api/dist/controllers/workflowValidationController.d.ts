import { RouteResponse } from '../routes';
/**
 * Controller for workflow validation and execution planning.
 * Handles dependency validation and execution plan generation.
 */
export declare class WorkflowValidationController {
    /**
     * Get the execution plan for a workflow.
     * Resolves step dependencies and groups steps by execution order.
     */
    getExecutionPlan(tenantId: string, workflowId: string): Promise<RouteResponse>;
    /**
     * Validate workflow step dependencies.
     * Checks for circular dependencies and invalid references.
     */
    validateDependencies(tenantId: string, workflowId: string, body: any): Promise<RouteResponse>;
}
export declare const workflowValidationController: WorkflowValidationController;
//# sourceMappingURL=workflowValidationController.d.ts.map