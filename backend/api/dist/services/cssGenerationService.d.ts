export interface CSSGenerationRequest {
    form_fields_schema: {
        fields: Array<{
            field_type: string;
            label: string;
            required: boolean;
        }>;
    };
    css_prompt: string;
    model?: string;
    tenantId: string;
}
export interface CSSRefinementRequest {
    current_css: string;
    css_prompt: string;
    model?: string;
    tenantId: string;
}
/**
 * Service for generating and refining CSS using AI.
 */
export declare class CSSGenerationService {
    /**
     * Generate CSS for a form based on a description.
     */
    generateCSS(request: CSSGenerationRequest): Promise<string>;
    /**
     * Refine existing CSS based on a prompt.
     */
    refineCSS(request: CSSRefinementRequest): Promise<string>;
    /**
     * Clean markdown code blocks from CSS content.
     */
    private cleanMarkdownCodeBlocks;
}
export declare const cssGenerationService: CSSGenerationService;
//# sourceMappingURL=cssGenerationService.d.ts.map