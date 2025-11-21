export interface TemplateGenerationRequest {
    description: string;
    model?: string;
    tenantId: string;
}
export interface TemplateRefinementRequest {
    current_html: string;
    edit_prompt: string;
    model?: string;
    tenantId: string;
}
/**
 * Service for generating and refining templates using AI.
 */
export declare class TemplateAIService {
    /**
     * Generate a template with AI.
     */
    generateWithAI(request: TemplateGenerationRequest): Promise<{
        template_name: string;
        template_description: string;
        html_content: string;
        placeholder_tags: string[];
    }>;
    /**
     * Refine a template with AI.
     */
    refineWithAI(request: TemplateRefinementRequest): Promise<{
        html_content: string;
        placeholder_tags: string[];
    }>;
    /**
     * Generate template name and description.
     */
    private generateTemplateMetadata;
    /**
     * Clean markdown code blocks from HTML content.
     */
    private cleanMarkdownCodeBlocks;
}
export declare const templateAIService: TemplateAIService;
//# sourceMappingURL=templateAIService.d.ts.map