import OpenAI from 'openai';
export interface GenerationResult {
    workflow: {
        workflow_name: string;
        workflow_description: string;
        steps: any[];
        research_instructions?: string;
    };
    template: {
        template_name: string;
        template_description: string;
        html_content: string;
        placeholder_tags: string[];
    };
    form: {
        form_name: string;
        public_slug: string;
        form_fields_schema: {
            fields: any[];
        };
    };
}
export interface UsageInfo {
    service_type: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
}
/**
 * Facade service that coordinates workflow, template, and form field generation.
 * Delegates to specialized services for each generation type.
 */
export declare class WorkflowGenerationService {
    private workflowConfigService;
    private templateGenerationService;
    private formFieldGenerationService;
    constructor(openai: OpenAI, storeUsageRecord: (tenantId: string, serviceType: string, model: string, inputTokens: number, outputTokens: number, costUsd: number, jobId?: string) => Promise<void>);
    /**
     * Generate workflow configuration from description
     * Delegates to WorkflowConfigService
     */
    generateWorkflowConfig(description: string, model: string, tenantId: string, jobId?: string, brandContext?: string, icpContext?: string): Promise<{
        workflowData: any;
        usageInfo: UsageInfo;
    }>;
    /**
     * Generate template HTML from description
     * Delegates to TemplateGenerationService
     */
    generateTemplateHTML(description: string, model: string, tenantId: string, jobId?: string, brandContext?: string, icpContext?: string): Promise<{
        htmlContent: string;
        usageInfo: UsageInfo;
    }>;
    /**
     * Generate template name and description
     * Delegates to TemplateGenerationService
     */
    generateTemplateMetadata(description: string, model: string, tenantId: string, jobId?: string, brandContext?: string, icpContext?: string): Promise<{
        templateName: string;
        templateDescription: string;
        usageInfo: UsageInfo;
    }>;
    /**
     * Generate form fields from description
     * Delegates to FormFieldGenerationService
     */
    generateFormFields(description: string, workflowName: string, model: string, tenantId: string, jobId?: string, brandContext?: string, icpContext?: string): Promise<{
        formData: any;
        usageInfo: UsageInfo;
    }>;
    /**
     * Process all generation results into final format
     */
    processGenerationResult(workflowData: any, templateName: string, templateDescription: string, htmlContent: string, formData: any): GenerationResult;
}
//# sourceMappingURL=workflowGenerationService.d.ts.map