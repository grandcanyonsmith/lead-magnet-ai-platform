import OpenAI from 'openai';
import { WorkflowConfigService } from './workflowConfigService';
import { FormFieldGenerationService } from '@domains/forms/services/formFieldGenerationService';
import type { PromptOverrides } from '@services/promptOverrides';

export interface GenerationResult {
  workflow: {
    workflow_name: string;
    workflow_description: string;
    steps: any[];
    research_instructions?: string;
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
  private formFieldGenerationService: FormFieldGenerationService;

  constructor(
    openai: OpenAI,
    storeUsageRecord: (
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
    jobId?: string,
    brandContext?: string,
    icpContext?: string,
    defaultToolChoice?: "auto" | "required" | "none",
    defaultServiceTier?: string,
    defaultTextVerbosity?: string,
    promptOverrides?: PromptOverrides,
  ): Promise<{ workflowData: any; usageInfo: UsageInfo }> {
    return this.workflowConfigService.generateWorkflowConfig(
      description,
      model,
      tenantId,
      jobId,
      brandContext,
      icpContext,
      defaultToolChoice,
      defaultServiceTier,
      defaultTextVerbosity,
      promptOverrides,
    );
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
    jobId?: string,
    brandContext?: string,
    icpContext?: string,
    promptOverrides?: PromptOverrides,
  ): Promise<{ formData: any; usageInfo: UsageInfo }> {
    return this.formFieldGenerationService.generateFormFields(
      description,
      workflowName,
      model,
      tenantId,
      jobId,
      brandContext,
      icpContext,
      promptOverrides,
    );
  }

  /**
   * Process all generation results into final format
   */
  processGenerationResult(
    workflowData: any,
    formData: any
  ): GenerationResult {
    return {
      workflow: {
        workflow_name: workflowData.workflow_name,
        workflow_description: workflowData.workflow_description,
        steps: workflowData.steps,
        research_instructions: workflowData.research_instructions || (workflowData.steps && workflowData.steps.length > 0 ? workflowData.steps[0].instructions : ''),
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

