import { ulid } from 'ulid';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import OpenAI from 'openai';
import { db } from '../utils/db';
import { validate, createWorkflowSchema, updateWorkflowSchema } from '../utils/validation';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';
import { calculateOpenAICost } from '../services/costService';

const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE!;
const USAGE_RECORDS_TABLE = process.env.USAGE_RECORDS_TABLE || 'leadmagnet-usage-records';
const OPENAI_SECRET_NAME = process.env.OPENAI_SECRET_NAME || 'leadmagnet/openai-api-key';
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

async function getOpenAIClient(): Promise<OpenAI> {
  const command = new GetSecretValueCommand({ SecretId: OPENAI_SECRET_NAME });
  const response = await secretsClient.send(command);
  
  if (!response.SecretString) {
    throw new ApiError('OpenAI API key not found in secret', 500);
  }

  let apiKey: string;
  
  try {
    const parsed = JSON.parse(response.SecretString);
    apiKey = parsed.OPENAI_API_KEY || parsed.apiKey || response.SecretString;
  } catch {
    apiKey = response.SecretString;
  }
  
  if (!apiKey || apiKey.trim().length === 0) {
    throw new ApiError('OpenAI API key is empty', 500);
  }

  return new OpenAI({ apiKey });
}

/**
 * Helper function to store usage record in DynamoDB.
 */
async function storeUsageRecord(
  tenantId: string,
  serviceType: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  costUsd: number,
  jobId?: string
): Promise<void> {
  try {
    const usageId = `usage_${ulid()}`;
    const usageRecord = {
      usage_id: usageId,
      tenant_id: tenantId,
      job_id: jobId || null,
      service_type: serviceType,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      created_at: new Date().toISOString(),
    };

    await db.put(USAGE_RECORDS_TABLE, usageRecord);
    console.log('[Usage Tracking] Usage record stored', {
      usageId,
      tenantId,
      serviceType,
      model,
      inputTokens,
      outputTokens,
      costUsd,
    });
  } catch (error: any) {
    console.error('[Usage Tracking] Failed to store usage record', {
      error: error.message,
      tenantId,
      serviceType,
    });
  }
}

class WorkflowsController {
  async list(tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse> {
    const status = queryParams.status;
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;

    let workflows;
    if (status) {
      workflows = await db.query(
        WORKFLOWS_TABLE,
        'gsi_tenant_status',
        'tenant_id = :tenant_id AND #status = :status',
        { ':tenant_id': tenantId, ':status': status },
        { '#status': 'status' },
        limit
      );
    } else {
      workflows = await db.query(
        WORKFLOWS_TABLE,
        'gsi_tenant_status',
        'tenant_id = :tenant_id',
        { ':tenant_id': tenantId },
        undefined,
        limit
      );
    }

    // Filter out soft-deleted items
    workflows = workflows.filter((w: any) => !w.deleted_at);

    return {
      statusCode: 200,
      body: {
        workflows,
        count: workflows.length,
      },
    };
  }

  async get(tenantId: string, workflowId: string): Promise<RouteResponse> {
    const workflow = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });

    if (!workflow || workflow.deleted_at) {
      throw new ApiError('Workflow not found', 404);
    }

    if (workflow.tenant_id !== tenantId) {
      throw new ApiError('Unauthorized', 403);
    }

    return {
      statusCode: 200,
      body: workflow,
    };
  }

  async create(tenantId: string, body: any): Promise<RouteResponse> {
    const data = validate(createWorkflowSchema, body);

    const workflow = {
      workflow_id: `wf_${ulid()}`,
      tenant_id: tenantId,
      ...data,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.put(WORKFLOWS_TABLE, workflow);

    return {
      statusCode: 201,
      body: workflow,
    };
  }

  async update(tenantId: string, workflowId: string, body: any): Promise<RouteResponse> {
    const existing = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });

    if (!existing || existing.deleted_at) {
      throw new ApiError('Workflow not found', 404);
    }

    if (existing.tenant_id !== tenantId) {
      throw new ApiError('Unauthorized', 403);
    }

    const data = validate(updateWorkflowSchema, body);

    const updated = await db.update(WORKFLOWS_TABLE, { workflow_id: workflowId }, {
      ...data,
      updated_at: new Date().toISOString(),
    });

    return {
      statusCode: 200,
      body: updated,
    };
  }

  async delete(tenantId: string, workflowId: string): Promise<RouteResponse> {
    const existing = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });

    if (!existing || existing.deleted_at) {
      throw new ApiError('Workflow not found', 404);
    }

    if (existing.tenant_id !== tenantId) {
      throw new ApiError('Unauthorized', 403);
    }

    // Soft delete
    await db.update(WORKFLOWS_TABLE, { workflow_id: workflowId }, {
      deleted_at: new Date().toISOString(),
    });

    return {
      statusCode: 204,
      body: {},
    };
  }

  async generateWithAI(tenantId: string, body: any): Promise<RouteResponse> {
    const { description, model = 'gpt-4o' } = body;

    if (!description || !description.trim()) {
      throw new ApiError('Description is required', 400);
    }

    console.log('[Workflow Generation] Starting AI generation', {
      tenantId,
      model,
      descriptionLength: description.length,
      timestamp: new Date().toISOString(),
    });

    try {
      const openai = await getOpenAIClient();
      console.log('[Workflow Generation] OpenAI client initialized');

      // Generate workflow configuration
      const workflowPrompt = `You are an expert at creating AI-powered lead magnets. Based on this description: "${description}", generate a complete lead magnet configuration.

Generate:
1. Lead Magnet Name (short, catchy, 2-4 words)
2. Lead Magnet Description (1-2 sentences explaining what it does)
3. Research Instructions (detailed instructions for AI to generate personalized research based on form submission data. Use [field_name] to reference form fields)

Return JSON format:
{
  "workflow_name": "...",
  "workflow_description": "...",
  "research_instructions": "..."
}`;

      console.log('[Workflow Generation] Calling OpenAI for workflow generation...');
      const workflowStartTime = Date.now();
      const workflowCompletionParams: any = {
        model,
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
        max_completion_tokens: 1000,
      };
      // GPT-5 only supports default temperature (1), don't set custom temperature
      if (model !== 'gpt-5') {
        workflowCompletionParams.temperature = 0.7;
      }
      const workflowCompletion = await openai.chat.completions.create(workflowCompletionParams);

      const workflowDuration = Date.now() - workflowStartTime;
      console.log('[Workflow Generation] Workflow generation completed', {
        duration: `${workflowDuration}ms`,
        tokensUsed: workflowCompletion.usage?.total_tokens,
      });

      // Track usage
      const workflowUsage = workflowCompletion.usage;
      if (workflowUsage) {
        const inputTokens = workflowUsage.prompt_tokens || 0;
        const outputTokens = workflowUsage.completion_tokens || 0;
        const costData = calculateOpenAICost(model, inputTokens, outputTokens);
        
        await storeUsageRecord(
          tenantId,
          'openai_workflow_generate',
          model,
          inputTokens,
          outputTokens,
          costData.cost_usd
        );
      }

      const workflowContent = workflowCompletion.choices[0]?.message?.content || '';
      let workflowData = {
        workflow_name: 'Generated Lead Magnet',
        workflow_description: description,
        research_instructions: `Generate a personalized report based on form submission data. Use [field_name] to reference form fields.`,
      };

      try {
        const jsonMatch = workflowContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          workflowData = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.warn('[Workflow Generation] Failed to parse workflow JSON, using defaults', e);
      }

      // Generate template HTML
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
      const templateCompletionParams: any = {
        model,
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
        max_completion_tokens: 4000,
      };
      // GPT-5 only supports default temperature (1), don't set custom temperature
      if (model !== 'gpt-5') {
        templateCompletionParams.temperature = 0.7;
      }
      const templateCompletion = await openai.chat.completions.create(templateCompletionParams);

      const templateDuration = Date.now() - templateStartTime;
      console.log('[Workflow Generation] Template HTML generation completed', {
        duration: `${templateDuration}ms`,
        tokensUsed: templateCompletion.usage?.total_tokens,
      });

      // Track usage
      const templateUsage = templateCompletion.usage;
      if (templateUsage) {
        const inputTokens = templateUsage.prompt_tokens || 0;
        const outputTokens = templateUsage.completion_tokens || 0;
        const costData = calculateOpenAICost(model, inputTokens, outputTokens);
        
        await storeUsageRecord(
          tenantId,
          'openai_template_generate',
          model,
          inputTokens,
          outputTokens,
          costData.cost_usd
        );
      }

      let cleanedHtml = templateCompletion.choices[0]?.message?.content || '';
      
      // Clean up markdown code blocks if present
      if (cleanedHtml.startsWith('```html')) {
        cleanedHtml = cleanedHtml.replace(/^```html\s*/i, '').replace(/\s*```$/i, '');
      } else if (cleanedHtml.startsWith('```')) {
        cleanedHtml = cleanedHtml.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      }

      // Extract placeholder tags (for backward compatibility, but templates won't have placeholders)
      const placeholderRegex = /\{\{([A-Z_]+)\}\}/g;
      const placeholderMatches = cleanedHtml.matchAll(placeholderRegex);
      const placeholders = new Set<string>();
      for (const match of placeholderMatches) {
        placeholders.add(match[1]);
      }
      const placeholderTags = Array.from(placeholders).sort();

      // Generate template name and description
      const templateNamePrompt = `Based on this lead magnet: "${description}", generate:
1. A short, descriptive template name (2-4 words max)
2. A brief template description (1-2 sentences)

Return JSON format: {"name": "...", "description": "..."}`;

      console.log('[Workflow Generation] Calling OpenAI for template name/description generation...');
      const templateNameStartTime = Date.now();
      const templateNameCompletionParams: any = {
        model,
        messages: [
          {
            role: 'user',
            content: templateNamePrompt,
          },
        ],
        max_completion_tokens: 200,
      };
      // GPT-5 only supports default temperature (1), don't set custom temperature
      if (model !== 'gpt-5') {
        templateNameCompletionParams.temperature = 0.5;
      }
      const templateNameCompletion = await openai.chat.completions.create(templateNameCompletionParams);

      const templateNameDuration = Date.now() - templateNameStartTime;
      console.log('[Workflow Generation] Template name/description generation completed', {
        duration: `${templateNameDuration}ms`,
      });

      // Track usage
      const templateNameUsage = templateNameCompletion.usage;
      if (templateNameUsage) {
        const inputTokens = templateNameUsage.prompt_tokens || 0;
        const outputTokens = templateNameUsage.completion_tokens || 0;
        const costData = calculateOpenAICost(model, inputTokens, outputTokens);
        
        await storeUsageRecord(
          tenantId,
          'openai_template_generate',
          model,
          inputTokens,
          outputTokens,
          costData.cost_usd
        );
      }

      const templateNameContent = templateNameCompletion.choices[0]?.message?.content || '';
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

      // Generate form fields
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
      const formCompletionParams: any = {
        model,
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
        max_completion_tokens: 1500,
      };
      // GPT-5 only supports default temperature (1), don't set custom temperature
      if (model !== 'gpt-5') {
        formCompletionParams.temperature = 0.7;
      }
      const formCompletion = await openai.chat.completions.create(formCompletionParams);

      const formDuration = Date.now() - formStartTime;
      console.log('[Workflow Generation] Form generation completed', {
        duration: `${formDuration}ms`,
        tokensUsed: formCompletion.usage?.total_tokens,
      });

      // Track usage
      const formUsage = formCompletion.usage;
      if (formUsage) {
        const inputTokens = formUsage.prompt_tokens || 0;
        const outputTokens = formUsage.completion_tokens || 0;
        const costData = calculateOpenAICost(model, inputTokens, outputTokens);
        
        await storeUsageRecord(
          tenantId,
          'openai_workflow_generate',
          model,
          inputTokens,
          outputTokens,
          costData.cost_usd
        );
      }

      const formContent = formCompletion.choices[0]?.message?.content || '';
      let formData = {
        form_name: `Form for ${workflowData.workflow_name}`,
        public_slug: workflowData.workflow_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
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

      const totalDuration = Date.now() - workflowStartTime;
      console.log('[Workflow Generation] Success!', {
        tenantId,
        workflowName: workflowData.workflow_name,
        templateName,
        htmlLength: cleanedHtml.length,
        placeholderCount: placeholderTags.length,
        formFieldsCount: formData.fields.length,
        totalDuration: `${totalDuration}ms`,
        timestamp: new Date().toISOString(),
      });

      return {
        statusCode: 200,
        body: {
          workflow: {
            workflow_name: workflowData.workflow_name,
            workflow_description: workflowData.workflow_description,
            research_instructions: workflowData.research_instructions,
          },
          template: {
            template_name: templateName,
            template_description: templateDescription,
            html_content: cleanedHtml.trim(),
            placeholder_tags: placeholderTags,
          },
          form: {
            form_name: formData.form_name,
            public_slug: formData.public_slug,
            form_fields_schema: {
              fields: formData.fields,
            },
          },
        },
      };
    } catch (error: any) {
      console.error('[Workflow Generation] Error occurred', {
        tenantId,
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw new ApiError(
        error.message || 'Failed to generate lead magnet with AI',
        500
      );
    }
  }

  async refineInstructions(tenantId: string, body: any): Promise<RouteResponse> {
    const { current_instructions, edit_prompt, model = 'gpt-4o' } = body;

    if (!current_instructions || !current_instructions.trim()) {
      throw new ApiError('Current instructions are required', 400);
    }

    if (!edit_prompt || !edit_prompt.trim()) {
      throw new ApiError('Edit prompt is required', 400);
    }

    console.log('[Workflow Instructions Refinement] Starting refinement', {
      tenantId,
      model,
      currentInstructionsLength: current_instructions.length,
      editPromptLength: edit_prompt.length,
      timestamp: new Date().toISOString(),
    });

    try {
      const openai = await getOpenAIClient();
      console.log('[Workflow Instructions Refinement] OpenAI client initialized');

      const prompt = `You are an expert AI prompt engineer. Modify the following research instructions for an AI lead magnet generator based on these requests: "${edit_prompt}"

Current Instructions:
${current_instructions}

Requirements:
1. Apply the requested changes while maintaining clarity and effectiveness
2. Keep the overall structure and format unless specifically asked to change it
3. Ensure the instructions remain actionable and specific
4. Preserve any field references like [field_name] syntax
5. Return only the modified instructions, no markdown formatting, no explanations

Return ONLY the modified instructions, no markdown formatting, no explanations.`;

      console.log('[Workflow Instructions Refinement] Calling OpenAI for refinement...', {
        model,
        promptLength: prompt.length,
      });

      const refineStartTime = Date.now();
      const completionParams: any = {
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert AI prompt engineer. Return only the modified instructions without markdown formatting.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_completion_tokens: 2000,
      };
      // GPT-5 only supports default temperature (1), don't set custom temperature
      if (model !== 'gpt-5') {
        completionParams.temperature = 0.7;
      }
      const completion = await openai.chat.completions.create(completionParams);

      const refineDuration = Date.now() - refineStartTime;
      console.log('[Workflow Instructions Refinement] Refinement completed', {
        duration: `${refineDuration}ms`,
        tokensUsed: completion.usage?.total_tokens,
        model: completion.model,
      });

      // Track usage
      const usage = completion.usage;
      if (usage) {
        const inputTokens = usage.prompt_tokens || 0;
        const outputTokens = usage.completion_tokens || 0;
        const costData = calculateOpenAICost(model, inputTokens, outputTokens);
        
        await storeUsageRecord(
          tenantId,
          'openai_workflow_refine',
          model,
          inputTokens,
          outputTokens,
          costData.cost_usd
        );
      }

      const instructionsContent = completion.choices[0]?.message?.content || '';
      console.log('[Workflow Instructions Refinement] Refined instructions received', {
        instructionsLength: instructionsContent.length,
        firstChars: instructionsContent.substring(0, 100),
      });
      
      // Clean up markdown code blocks if present
      let cleanedInstructions = instructionsContent.trim();
      if (cleanedInstructions.startsWith('```')) {
        cleanedInstructions = cleanedInstructions.replace(/^```\w*\s*/i, '').replace(/\s*```$/i, '');
        console.log('[Workflow Instructions Refinement] Removed ``` markers');
      }

      const totalDuration = Date.now() - refineStartTime;
      console.log('[Workflow Instructions Refinement] Success!', {
        tenantId,
        instructionsLength: cleanedInstructions.length,
        totalDuration: `${totalDuration}ms`,
        timestamp: new Date().toISOString(),
      });

      return {
        statusCode: 200,
        body: {
          instructions: cleanedInstructions,
        },
      };
    } catch (error: any) {
      console.error('[Workflow Instructions Refinement] Error occurred', {
        tenantId,
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw new ApiError(
        error.message || 'Failed to refine instructions with AI',
        500
      );
    }
  }
}

export const workflowsController = new WorkflowsController();

