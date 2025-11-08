import OpenAI from 'openai';
import { calculateOpenAICost } from './costService';
import { callResponsesWithTimeout } from '../utils/openaiHelpers';

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

export class WorkflowGenerationService {
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
  ) {}

  /**
   * Generate workflow configuration from description
   */
  async generateWorkflowConfig(
    description: string,
    model: string,
    tenantId: string,
    jobId?: string
  ): Promise<{ workflowData: any; usageInfo: UsageInfo }> {
    const workflowPrompt = `You are an expert at creating AI-powered lead magnets. Based on this description: "${description}", generate a complete lead magnet configuration with workflow steps.

Generate:
1. Lead Magnet Name (short, catchy, 2-4 words)
2. Lead Magnet Description (1-2 sentences explaining what it does)
3. Workflow Steps (array of steps, each with appropriate tools and tool_choice)

Available OpenAI Tools:
- web_search / web_search_preview: For research steps that need current information from the web
- image_generation: For steps that need to generate images
- computer_use_preview: For steps that need to control computer interfaces (rarely needed for lead magnets)
- file_search: For steps that need to search uploaded files
- code_interpreter: For steps that need to execute Python code

Tool Choice Options:
- "auto": Model decides when to use tools (recommended for most steps)
- "required": Model must use at least one tool (use when tools are essential)
- "none": Disable tools entirely (use for HTML generation or final formatting steps)

Return JSON format:
{
  "workflow_name": "...",
  "workflow_description": "...",
  "steps": [
    {
      "step_name": "Deep Research",
      "step_description": "Generate comprehensive research report",
      "model": "o3-deep-research",
      "instructions": "Detailed instructions for AI to generate personalized research based on form submission data. Use [field_name] to reference form fields.",
      "step_order": 0,
      "tools": ["web_search_preview"],
      "tool_choice": "auto"
    },
    {
      "step_name": "HTML Rewrite",
      "step_description": "Rewrite content into styled HTML matching template",
      "model": "gpt-5",
      "instructions": "Rewrite the research content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template's design and structure.",
      "step_order": 1,
      "tools": [],
      "tool_choice": "none"
    }
  ]
}

Available Models:
- o3-deep-research: For deep research and analysis steps
- gpt-5: For high-quality content generation and HTML rewriting
- gpt-4.1: For high-quality content generation with Code Interpreter support
- gpt-4o: For general-purpose content generation
- gpt-4-turbo: For faster content generation
- gpt-3.5-turbo: For cost-effective content generation

Guidelines for selecting tools:
- Research/analysis steps: Use web_search or web_search_preview with tool_choice "auto"
- HTML generation/formatting steps: Use empty tools array [] with tool_choice "none"
- Steps requiring images: Consider image_generation with tool_choice "auto"
- Most steps should use tool_choice "auto" unless tools are absolutely required or should be disabled`;

    console.log('[Workflow Generation] Calling OpenAI for workflow generation...');
    const workflowStartTime = Date.now();
    
    let workflowCompletion;
    try {
      const workflowCompletionParams: any = {
        model,
        instructions: 'You are an expert at creating AI-powered lead magnets. Return only valid JSON without markdown formatting.',
        input: workflowPrompt,
      };
      if (model !== 'gpt-5') {
        workflowCompletionParams.temperature = 0.7;
      }
      workflowCompletion = await callResponsesWithTimeout(
        () => this.openai.responses.create(workflowCompletionParams),
        'workflow generation'
      );
    } catch (apiError: any) {
      console.error('[Workflow Generation] Responses API error, attempting fallback', {
        error: apiError?.message,
      });
      workflowCompletion = await this.openai.chat.completions.create({
        model: model === 'gpt-5' ? 'gpt-4o' : model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at creating AI-powered lead magnets. Return only valid JSON without markdown formatting.',
          },
          {
            role: 'user',
            content: workflowPrompt,
          },
        ],
        temperature: model === 'gpt-5' ? undefined : 0.7,
      });
    }

    const workflowDuration = Date.now() - workflowStartTime;
    const workflowUsedModel = (workflowCompletion as any).model || model;
    console.log('[Workflow Generation] Workflow generation completed', {
      duration: `${workflowDuration}ms`,
      tokensUsed: workflowCompletion.usage?.total_tokens,
      modelUsed: workflowUsedModel,
    });

    // Track usage
    const workflowUsage = workflowCompletion.usage;
    let usageInfo: UsageInfo = {
      service_type: 'openai_workflow_generate',
      model: workflowUsedModel,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
    };

    if (workflowUsage) {
      const inputTokens = ('input_tokens' in workflowUsage ? workflowUsage.input_tokens : workflowUsage.prompt_tokens) || 0;
      const outputTokens = ('output_tokens' in workflowUsage ? workflowUsage.output_tokens : workflowUsage.completion_tokens) || 0;
      const costData = calculateOpenAICost(workflowUsedModel, inputTokens, outputTokens);
      
      usageInfo = {
        service_type: 'openai_workflow_generate',
        model: workflowUsedModel,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costData.cost_usd,
      };

      await this.storeUsageRecord(
        tenantId,
        'openai_workflow_generate',
        workflowUsedModel,
        inputTokens,
        outputTokens,
        costData.cost_usd,
        jobId
      );
    }

    const workflowContent = ('output_text' in workflowCompletion ? workflowCompletion.output_text : workflowCompletion.choices?.[0]?.message?.content) || '';
    const workflowData = this.parseWorkflowConfig(workflowContent, description);

    return { workflowData, usageInfo };
  }

  /**
   * Parse workflow configuration from AI response
   */
  private parseWorkflowConfig(content: string, description: string): any {
    let workflowData: any = {
      workflow_name: 'Generated Lead Magnet',
      workflow_description: description,
      steps: [
        {
          step_name: 'Deep Research',
          step_description: 'Generate comprehensive research report',
          model: 'o3-deep-research',
          instructions: `Generate a personalized report based on form submission data. Use [field_name] to reference form fields.`,
          step_order: 0,
          tools: ['web_search_preview'],
          tool_choice: 'auto',
        },
        {
          step_name: 'HTML Rewrite',
          step_description: 'Rewrite content into styled HTML matching template',
          model: 'gpt-5',
          instructions: 'Rewrite the research content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template\'s design and structure.',
          step_order: 1,
          tools: [],
          tool_choice: 'none',
        },
      ],
    };

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // If parsed data has steps, use it; otherwise fall back to legacy format
        if (parsed.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
          workflowData = {
            workflow_name: parsed.workflow_name || workflowData.workflow_name,
            workflow_description: parsed.workflow_description || workflowData.workflow_description,
            steps: parsed.steps.map((step: any, index: number) => ({
              step_name: step.step_name || `Step ${index + 1}`,
              step_description: step.step_description || '',
              model: step.model || (index === 0 ? 'o3-deep-research' : 'gpt-5'),
              instructions: step.instructions || '',
              step_order: step.step_order !== undefined ? step.step_order : index,
              tools: step.tools || (index === 0 ? ['web_search_preview'] : []),
              tool_choice: step.tool_choice || (index === 0 ? 'auto' : 'none'),
            })),
          };
        } else if (parsed.research_instructions) {
          // Legacy format - convert to steps
          workflowData = {
            workflow_name: parsed.workflow_name || workflowData.workflow_name,
            workflow_description: parsed.workflow_description || workflowData.workflow_description,
            steps: [
              {
                step_name: 'Deep Research',
                step_description: 'Generate comprehensive research report',
                model: 'o3-deep-research',
                instructions: parsed.research_instructions,
                step_order: 0,
                tools: ['web_search_preview'],
                tool_choice: 'auto',
              },
              {
                step_name: 'HTML Rewrite',
                step_description: 'Rewrite content into styled HTML matching template',
                model: 'gpt-5',
                instructions: 'Rewrite the research content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template\'s design and structure.',
                step_order: 1,
                tools: [],
                tool_choice: 'none',
              },
            ],
          };
        } else {
          // Partial update - merge with defaults
          workflowData = {
            ...workflowData,
            workflow_name: parsed.workflow_name || workflowData.workflow_name,
            workflow_description: parsed.workflow_description || workflowData.workflow_description,
          };
        }
      }
    } catch (e) {
      console.warn('[Workflow Generation] Failed to parse workflow JSON, using defaults', e);
    }

    return workflowData;
  }

  /**
   * Generate template HTML from description
   */
  async generateTemplateHTML(
    description: string,
    model: string,
    tenantId: string,
    jobId?: string
  ): Promise<{ htmlContent: string; usageInfo: UsageInfo }> {
    const templatePrompt = `You are an expert HTML template designer for lead magnets. Create a professional HTML template for: "${description}"

Requirements:
1. Generate a complete, valid HTML5 document
2. Include modern, clean CSS styling (inline or in <style> tag)
3. DO NOT use placeholder syntax - use actual sample content and descriptive text
4. Make it responsive and mobile-friendly
5. Use professional color scheme and typography
6. Design it to beautifully display lead magnet content
7. Include actual text content that demonstrates the design - use sample headings, paragraphs, and sections
8. The HTML should be ready to use with real content filled in manually or via code

Return ONLY the HTML code, no markdown formatting, no explanations.`;

    console.log('[Workflow Generation] Calling OpenAI for template HTML generation...');
    const templateStartTime = Date.now();
    
    let templateCompletion;
    try {
      const templateCompletionParams: any = {
        model,
        instructions: 'You are an expert HTML template designer. Return only valid HTML code without markdown formatting.',
        input: templatePrompt,
      };
      if (model !== 'gpt-5') {
        templateCompletionParams.temperature = 0.7;
      }
      templateCompletion = await callResponsesWithTimeout(
        () => this.openai.responses.create(templateCompletionParams),
        'template HTML generation'
      );
    } catch (apiError: any) {
      console.error('[Workflow Generation] Responses API error for template, attempting fallback', {
        error: apiError?.message,
      });
      templateCompletion = await this.openai.chat.completions.create({
        model: model === 'gpt-5' ? 'gpt-4o' : model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert HTML template designer. Return only valid HTML code without markdown formatting.',
          },
          {
            role: 'user',
            content: templatePrompt,
          },
        ],
        temperature: model === 'gpt-5' ? undefined : 0.7,
      });
    }

    const templateDuration = Date.now() - templateStartTime;
    const templateModelUsed = (templateCompletion as any).model || model;
    console.log('[Workflow Generation] Template HTML generation completed', {
      duration: `${templateDuration}ms`,
      tokensUsed: templateCompletion.usage?.total_tokens,
      modelUsed: templateModelUsed,
    });

    // Track usage
    const templateUsage = templateCompletion.usage;
    let usageInfo: UsageInfo = {
      service_type: 'openai_template_generate',
      model: templateModelUsed,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
    };

    if (templateUsage) {
      const inputTokens = ('input_tokens' in templateUsage ? templateUsage.input_tokens : templateUsage.prompt_tokens) || 0;
      const outputTokens = ('output_tokens' in templateUsage ? templateUsage.output_tokens : templateUsage.completion_tokens) || 0;
      const costData = calculateOpenAICost(templateModelUsed, inputTokens, outputTokens);
      
      usageInfo = {
        service_type: 'openai_template_generate',
        model: templateModelUsed,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costData.cost_usd,
      };

      await this.storeUsageRecord(
        tenantId,
        'openai_template_generate',
        templateModelUsed,
        inputTokens,
        outputTokens,
        costData.cost_usd,
        jobId
      );
    }

    let cleanedHtml = ('output_text' in templateCompletion ? templateCompletion.output_text : templateCompletion.choices?.[0]?.message?.content) || '';
    
    // Clean up markdown code blocks if present
    if (cleanedHtml.startsWith('```html')) {
      cleanedHtml = cleanedHtml.replace(/^```html\s*/i, '').replace(/\s*```$/i, '');
    } else if (cleanedHtml.startsWith('```')) {
      cleanedHtml = cleanedHtml.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    }

    return { htmlContent: cleanedHtml.trim(), usageInfo };
  }

  /**
   * Generate template name and description
   */
  async generateTemplateMetadata(
    description: string,
    model: string,
    tenantId: string,
    jobId?: string
  ): Promise<{ templateName: string; templateDescription: string; usageInfo: UsageInfo }> {
    const templateNamePrompt = `Based on this lead magnet: "${description}", generate:
1. A short, descriptive template name (2-4 words max)
2. A brief template description (1-2 sentences)

Return JSON format: {"name": "...", "description": "..."}`;

    console.log('[Workflow Generation] Calling OpenAI for template name/description generation...');
    const templateNameStartTime = Date.now();
    
    let templateNameCompletion;
    try {
      const templateNameCompletionParams: any = {
        model,
        input: templateNamePrompt,
      };
      if (model !== 'gpt-5') {
        templateNameCompletionParams.temperature = 0.5;
      }
      templateNameCompletion = await callResponsesWithTimeout(
        () => this.openai.responses.create(templateNameCompletionParams),
        'template name generation'
      );
    } catch (apiError: any) {
      console.error('[Workflow Generation] Responses API error for name, attempting fallback', {
        error: apiError?.message,
      });
      templateNameCompletion = await this.openai.chat.completions.create({
        model: model === 'gpt-5' ? 'gpt-4o' : model,
        messages: [
          {
            role: 'user',
            content: templateNamePrompt,
          },
        ],
        temperature: model === 'gpt-5' ? undefined : 0.5,
      });
    }

    const templateNameDuration = Date.now() - templateNameStartTime;
    const templateNameModel = (templateNameCompletion as any).model || model;
    console.log('[Workflow Generation] Template name/description generation completed', {
      duration: `${templateNameDuration}ms`,
      modelUsed: templateNameModel,
    });

    // Track usage
    const templateNameUsage = templateNameCompletion.usage;
    let usageInfo: UsageInfo = {
      service_type: 'openai_template_generate',
      model: templateNameModel,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
    };

    if (templateNameUsage) {
      const inputTokens = ('input_tokens' in templateNameUsage ? templateNameUsage.input_tokens : templateNameUsage.prompt_tokens) || 0;
      const outputTokens = ('output_tokens' in templateNameUsage ? templateNameUsage.output_tokens : templateNameUsage.completion_tokens) || 0;
      const costData = calculateOpenAICost(templateNameModel, inputTokens, outputTokens);
      
      usageInfo = {
        service_type: 'openai_template_generate',
        model: templateNameModel,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costData.cost_usd,
      };

      await this.storeUsageRecord(
        tenantId,
        'openai_template_generate',
        templateNameModel,
        inputTokens,
        outputTokens,
        costData.cost_usd,
        jobId
      );
    }

    const templateNameContent = ('output_text' in templateNameCompletion ? templateNameCompletion.output_text : templateNameCompletion.choices?.[0]?.message?.content) || '';
    let templateName = 'Generated Template';
    let templateDescription = 'A professional HTML template for displaying lead magnet content';

    try {
      const jsonMatch = templateNameContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        templateName = parsed.name || templateName;
        templateDescription = parsed.description || templateDescription;
      }
    } catch (e) {
      console.warn('[Workflow Generation] Failed to parse template name JSON, using defaults', e);
    }

    return { templateName, templateDescription, usageInfo };
  }

  /**
   * Generate form fields from description
   */
  async generateFormFields(
    description: string,
    workflowName: string,
    model: string,
    tenantId: string,
    jobId?: string
  ): Promise<{ formData: any; usageInfo: UsageInfo }> {
    const formPrompt = `You are an expert at creating lead capture forms. Based on this lead magnet: "${description}", generate appropriate form fields.

The form should collect all necessary information needed to personalize the lead magnet. Think about what data would be useful for:
- Personalizing the AI-generated content
- Contacting the lead
- Understanding their needs

Generate 3-6 form fields. Common field types: text, email, tel, textarea, select, number.

Return JSON format:
{
  "form_name": "...",
  "public_slug": "...",
  "fields": [
    {
      "field_id": "field_1",
      "field_type": "text|email|tel|textarea|select|number",
      "label": "...",
      "placeholder": "...",
      "required": true|false,
      "options": ["option1", "option2"] // only for select fields
    }
  ]
}

The public_slug should be URL-friendly (lowercase, hyphens only, no spaces).`;

    console.log('[Workflow Generation] Calling OpenAI for form generation...');
    const formStartTime = Date.now();
    
    let formCompletion;
    try {
      const formCompletionParams: any = {
        model,
        instructions: 'You are an expert at creating lead capture forms. Return only valid JSON without markdown formatting.',
        input: formPrompt,
      };
      if (model !== 'gpt-5') {
        formCompletionParams.temperature = 0.7;
      }
      formCompletion = await callResponsesWithTimeout(
        () => this.openai.responses.create(formCompletionParams),
        'form generation'
      );
    } catch (apiError: any) {
      console.error('[Workflow Generation] Responses API error for form, attempting fallback', {
        error: apiError?.message,
      });
      formCompletion = await this.openai.chat.completions.create({
        model: model === 'gpt-5' ? 'gpt-4o' : model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at creating lead capture forms. Return only valid JSON without markdown formatting.',
          },
          {
            role: 'user',
            content: formPrompt,
          },
        ],
        temperature: model === 'gpt-5' ? undefined : 0.7,
      });
    }

    const formDuration = Date.now() - formStartTime;
    const formModelUsed = (formCompletion as any).model || model;
    console.log('[Workflow Generation] Form generation completed', {
      duration: `${formDuration}ms`,
      tokensUsed: formCompletion.usage?.total_tokens,
      modelUsed: formModelUsed,
    });

    // Track usage
    const formUsage = formCompletion.usage;
    let usageInfo: UsageInfo = {
      service_type: 'openai_workflow_generate',
      model: formModelUsed,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
    };

    if (formUsage) {
      const inputTokens = ('input_tokens' in formUsage ? formUsage.input_tokens : formUsage.prompt_tokens) || 0;
      const outputTokens = ('output_tokens' in formUsage ? formUsage.output_tokens : formUsage.completion_tokens) || 0;
      const costData = calculateOpenAICost(formModelUsed, inputTokens, outputTokens);
      
      usageInfo = {
        service_type: 'openai_workflow_generate',
        model: formModelUsed,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costData.cost_usd,
      };

      await this.storeUsageRecord(
        tenantId,
        'openai_workflow_generate',
        formModelUsed,
        inputTokens,
        outputTokens,
        costData.cost_usd,
        jobId
      );
    }

    const formContent = ('output_text' in formCompletion ? formCompletion.output_text : formCompletion.choices?.[0]?.message?.content) || '';
    let formData = {
      form_name: `Form for ${workflowName}`,
      public_slug: workflowName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      fields: [
        {
          field_id: 'field_1',
          field_type: 'email',
          label: 'Email Address',
          placeholder: 'your@email.com',
          required: true,
        },
        {
          field_id: 'field_2',
          field_type: 'text',
          label: 'Name',
          placeholder: 'Your Name',
          required: true,
        },
      ],
    };

    try {
      const jsonMatch = formContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        formData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('[Workflow Generation] Failed to parse form JSON, using defaults', e);
    }

    // Ensure field_id is generated for each field if missing
    formData.fields = formData.fields.map((field: any, index: number) => ({
      ...field,
      field_id: field.field_id || `field_${index + 1}`,
    }));

    return { formData, usageInfo };
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

