import { RouteResponse } from '../routes';
/**
 * Controller for AI-powered form operations.
 * Handles CSS generation and refinement.
 */
export declare class FormAIController {
    /**
     * Generate CSS for a form using AI.
     */
    generateCSS(tenantId: string, body: any): Promise<RouteResponse>;
    /**
     * Refine CSS for a form using AI.
     */
    refineCSS(tenantId: string, body: any): Promise<RouteResponse>;
}
export declare const formAIController: FormAIController;
//# sourceMappingURL=formAIController.d.ts.map