"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowGenerationService = void 0;
const workflowConfigService_1 = require("./workflowConfigService");
const templateGenerationService_1 = require("./templateGenerationService");
const formFieldGenerationService_1 = require("./formFieldGenerationService");
/**
 * Facade service that coordinates workflow, template, and form field generation.
 * Delegates to specialized services for each generation type.
 */
class WorkflowGenerationService {
    constructor(openai, storeUsageRecord) {
        this.workflowConfigService = new workflowConfigService_1.WorkflowConfigService(openai, storeUsageRecord);
        this.templateGenerationService = new templateGenerationService_1.TemplateGenerationService(openai, storeUsageRecord);
        this.formFieldGenerationService = new formFieldGenerationService_1.FormFieldGenerationService(openai, storeUsageRecord);
    }
    /**
     * Generate workflow configuration from description
     * Delegates to WorkflowConfigService
     */
    async generateWorkflowConfig(description, model, tenantId, jobId, brandContext, icpContext) {
        return this.workflowConfigService.generateWorkflowConfig(description, model, tenantId, jobId, brandContext, icpContext);
    }
    /**
     * Generate template HTML from description
     * Delegates to TemplateGenerationService
     */
    async generateTemplateHTML(description, model, tenantId, jobId, brandContext, icpContext) {
        return this.templateGenerationService.generateTemplateHTML(description, model, tenantId, jobId, brandContext, icpContext);
    }
    /**
     * Generate template name and description
     * Delegates to TemplateGenerationService
     */
    async generateTemplateMetadata(description, model, tenantId, jobId, brandContext, icpContext) {
        return this.templateGenerationService.generateTemplateMetadata(description, model, tenantId, jobId, brandContext, icpContext);
    }
    /**
     * Generate form fields from description
     * Delegates to FormFieldGenerationService
     */
    async generateFormFields(description, workflowName, model, tenantId, jobId, brandContext, icpContext) {
        return this.formFieldGenerationService.generateFormFields(description, workflowName, model, tenantId, jobId, brandContext, icpContext);
    }
    /**
     * Process all generation results into final format
     */
    processGenerationResult(workflowData, templateName, templateDescription, htmlContent, formData) {
        return {
            workflow: {
                workflow_name: workflowData.workflow_name,
                workflow_description: workflowData.workflow_description,
                steps: workflowData.steps,
                research_instructions: workflowData.research_instructions || (workflowData.steps && workflowData.steps.length > 0 ? workflowData.steps[0].instructions : ''),
            },
            template: {
                template_name: templateName,
                template_description: templateDescription,
                html_content: htmlContent,
                placeholder_tags: [],
            },
            form: {
                form_name: formData.form_name,
                public_slug: formData.public_slug,
                form_fields_schema: {
                    fields: formData.fields,
                },
            },
        };
    }
}
exports.WorkflowGenerationService = WorkflowGenerationService;
//# sourceMappingURL=workflowGenerationService.js.map