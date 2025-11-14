import OpenAI from 'openai';
import { WorkflowConfigService } from './workflowConfigService';
import { TemplateGenerationService } from './templateGenerationService';
import { FormFieldGenerationService } from './formFieldGenerationService';

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
export class WorkflowGenerationService {
  private workflowConfigService: WorkflowConfigService;
  private templateGenerationService: TemplateGenerationService;
  private formFieldGenerationService: FormFieldGenerationService;

  constructor(
    private openai: OpenAI,
    private storeUsageRecord: (
      tenantId: string,
      serviceType: string,
      model: string,
      inputTokens: number,
      outputTokens: number,
      costUsd: number,
      jobId?: string
    ) => Promise<void>
  ) {
    this.workflowConfigService = new WorkflowConfigService(openai, storeUsageRecord);
    this.templateGenerationService = new TemplateGenerationService(openai, storeUsageRecord);
    this.formFieldGenerationService = new FormFieldGenerationService(openai, storeUsageRecord);
  }

  /**
   * Generate workflow configuration from description
   * Delegates to WorkflowConfigService
   */
  async generateWorkflowConfig(
    description: string,
    model: string,
    tenantId: string,
    jobId?: string
  ): Promise<{ workflowData: any; usageInfo: UsageInfo }> {
    return this.workflowConfigService.generateWorkflowConfig(description, model, tenantId, jobId);
  }

  /**
   * Generate template HTML from description
   * Delegates to TemplateGenerationService
   */
  async generateTemplateHTML(
    description: string,
    model: string,
    tenantId: string,
    jobId?: string
  ): Promise<{ htmlContent: string; usageInfo: UsageInfo }> {
    return this.templateGenerationService.generateTemplateHTML(description, model, tenantId, jobId);
  }

  /**
   * Generate template name and description
   * Delegates to TemplateGenerationService
   */
  async generateTemplateMetadata(
    description: string,
    model: string,
    tenantId: string,
    jobId?: string
  ): Promise<{ templateName: string; templateDescription: string; usageInfo: UsageInfo }> {
    return this.templateGenerationService.generateTemplateMetadata(description, model, tenantId, jobId);
  }

  /**
   * Generate form fields from description
   * Delegates to FormFieldGenerationService
   */
  async generateFormFields(
    description: string,
    workflowName: string,
    model: string,
    tenantId: string,
    jobId?: string
  ): Promise<{ formData: any; usageInfo: UsageInfo }> {
    return this.formFieldGenerationService.generateFormFields(description, workflowName, model, tenantId, jobId);
  }

  /**
   * Process all generation results into final format
   */
  processGenerationResult(
    workflowData: any,
    templateName: string,
    templateDescription: string,
    htmlContent: string,
    formData: any
  ): GenerationResult {
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

