export interface WorkflowInstructionsRefinementRequest {
    current_instructions: string;
    edit_prompt: string;
    model?: string;
    tenantId: string;
}
/**
 * Service for refining workflow instructions using AI.
 */
export declare class WorkflowInstructionsService {
    /**
     * Refine workflow instructions using AI.
     */
    refineInstructions(request: WorkflowInstructionsRefinementRequest): Promise<string>;
    /**
     * Build the refinement prompt with comprehensive guidance.
     */
    private buildRefinementPrompt;
    /**
     * Clean markdown code blocks from content.
     */
    private cleanMarkdownCodeBlocks;
}
export declare const workflowInstructionsService: WorkflowInstructionsService;
//# sourceMappingURL=workflowInstructionsService.d.ts.map