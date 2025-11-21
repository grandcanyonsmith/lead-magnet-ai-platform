/**
 * Workflow Prompt Builder
 * Constructs prompts for workflow configuration generation.
 */
export interface WorkflowPromptContext {
    description: string;
    brandContext?: string;
    icpContext?: string;
}
/**
 * Build the workflow generation prompt with comprehensive guidance.
 */
export declare function buildWorkflowPrompt(context: WorkflowPromptContext): string;
//# sourceMappingURL=workflowPromptBuilder.d.ts.map