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

## What to Generate

1. Lead Magnet Name: Short, catchy, 2-4 words that clearly communicate value
2. Lead Magnet Description: 1-2 sentences explaining what it does and why it's valuable
3. Workflow Steps: Array of steps, each with appropriate tools, model, and detailed instructions

## Available OpenAI Tools

### web_search / web_search_preview
- **Use when**: Step needs current information from the web, research, or real-time data
- **Examples**: Market research, competitor analysis, current trends, news, statistics
- **Tool choice**: "auto" (let model decide when to search)
- **Note**: web_search_preview is recommended for most use cases

### image_generation
- **Use when**: Step needs to create visual content (diagrams, illustrations, graphics)
- **Examples**: Creating infographics, visual summaries, custom images
- **Tool choice**: "auto" or "required" if images are essential
- **Note**: Generated images will be available to subsequent steps

### code_interpreter
- **Use when**: Step needs to execute Python code for calculations, data processing, or analysis
- **Examples**: Data analysis, calculations, generating charts/graphs, processing data
- **Tool choice**: "auto" or "required" if code execution is essential
- **Note**: Requires container configuration (auto-added by system)

### file_search
- **Use when**: Step needs to search through uploaded files or documents
- **Examples**: Analyzing uploaded PDFs, searching documents, extracting information from files
- **Tool choice**: "auto"
- **Note**: Requires vector_store_ids configuration (not commonly used)

### computer_use_preview
- **Use when**: Step needs to control computer interfaces (rarely needed for lead magnets)
- **Examples**: Interacting with web applications, taking screenshots, browser automation
- **Tool choice**: "auto" or "required"
- **Note**: Requires container configuration and is rarely needed for lead magnets

## Tool Choice Options

- **"auto"**: Model decides when to use tools (RECOMMENDED for most steps)
  - Use for: Research steps, content generation with optional tools, most common cases
- **"required"**: Model must use at least one tool (use sparingly)
  - Use for: Steps where tools are absolutely essential (e.g., must search web, must generate image)
  - Warning: Only use when tools are guaranteed to be available
- **"none"**: Disable tools entirely
  - Use for: HTML generation, final formatting, pure content transformation steps

## Available Models

### o3-deep-research
- **Best for**: Deep research, comprehensive analysis, complex reasoning
- **Use when**: Step requires extensive research or deep analytical thinking
- **Cost**: Higher cost, highest quality research output
- **Speed**: Slower than other models

### gpt-5
- **Best for**: High-quality content generation, HTML rewriting, general-purpose tasks
- **Use when**: You need the best quality output for content generation
- **Cost**: Higher cost, premium quality
- **Speed**: Moderate

### gpt-4.1
- **Best for**: High-quality content with Code Interpreter support
- **Use when**: You need code execution capabilities with high quality
- **Cost**: Moderate-high
- **Speed**: Moderate

### gpt-4o
- **Best for**: General-purpose content generation, balanced quality and cost
- **Use when**: Good quality is needed but cost is a consideration
- **Cost**: Moderate
- **Speed**: Fast

### gpt-4-turbo
- **Best for**: Faster content generation with good quality
- **Use when**: Speed is important and quality is acceptable
- **Cost**: Moderate
- **Speed**: Very fast

### gpt-3.5-turbo
- **Best for**: Cost-effective content generation
- **Use when**: Cost is primary concern and basic quality is acceptable
- **Cost**: Low
- **Speed**: Very fast

## Writing Effective Step Instructions

### Good Instruction Examples:

**Example 1 - Research Step:**
\`\`\`
Generate a comprehensive market research report for [company_name] in the [industry] industry. Research current market trends, competitor landscape, and growth opportunities. Include specific statistics, recent developments, and actionable insights. Personalize all recommendations based on [company_name]'s size ([company_size]) and target market ([target_market]).
\`\`\`

**Example 2 - Analysis Step:**
\`\`\`
Analyze the research findings from Step 1 and create a personalized SWOT analysis for [company_name]. Focus on opportunities and threats specific to the [industry] industry. Include actionable recommendations based on [company_name]'s current situation ([current_challenges]).
\`\`\`

**Example 3 - Content Generation Step:**
\`\`\`
Create a personalized action plan document for [name] at [company_name]. Use insights from previous steps to create 5-7 specific, actionable recommendations. Format as a clear, professional document with sections for each recommendation. Include timelines and expected outcomes where relevant.
\`\`\`

### Bad Instruction Examples (Avoid These):

❌ "Generate a report" (too vague, no guidance)
❌ "Do research" (not specific about what to research)
❌ "Create content" (no structure or requirements)
❌ "Make it good" (subjective, not actionable)

### Instruction Best Practices:

1. **Be Specific**: Clearly state what the step should produce
2. **Reference Form Fields**: Use [field_name] syntax to reference form submission data
3. **Reference Previous Steps**: Mention how to use outputs from earlier steps
4. **Define Output Format**: Specify structure, sections, or format expectations
5. **Set Quality Standards**: Include expectations for depth, detail, or comprehensiveness
6. **Personalize**: Always include guidance on personalizing content from form data

## Step Ordering and Dependencies

- **Step 0**: Usually research or data gathering (uses form submission data)
- **Step 1+**: Build upon previous steps, transform or enhance content
- **Final Step**: Often HTML generation (tool_choice: "none", tools: [])

**Dependencies (`depends_on` field):**
- Use `depends_on` to explicitly control which steps must complete before this step runs
- `depends_on` is an array of step indices (0-based) that this step depends on
- If `depends_on` is not provided, dependencies are auto-detected from `step_order`:
  - Steps with the same `step_order` can run in parallel
  - Steps with higher `step_order` depend on all steps with lower `step_order`
- **Example**: If Step 2 depends on Step 0 and Step 1, set `depends_on: [0, 1]`
- **Parallel execution**: Steps with same `step_order` and no explicit `depends_on` can run simultaneously

Common patterns:
- Research → Analysis → Content Generation → HTML Formatting
- Data Collection → Processing → Visualization → Final Document
- Research → Personalization → Formatting
- Parallel research: Multiple research steps with `step_order: 0` and `depends_on: []` can run in parallel

## Output Format Expectations

### Research Steps:
- Output: Markdown report with headings, sections, data, insights
- Format: Structured markdown with clear organization

### Analysis Steps:
- Output: Analysis, summaries, or transformations of previous step content
- Format: Markdown with logical sections

### Content Generation Steps:
- Output: New content based on previous steps and form data
- Format: Markdown or structured content

### HTML Generation Steps:
- Output: Complete HTML document matching template
- Format: Valid HTML5 (no markdown)

## Example Workflow Structure

\`\`\`json
{
  "workflow_name": "Personalized Market Analysis",
  "workflow_description": "Generates a comprehensive market analysis report personalized to the user's company and industry.",
  "steps": [
    {
      "step_name": "Deep Research",
      "step_description": "Conduct comprehensive market research using web search",
      "model": "o3-deep-research",
      "instructions": "Generate a comprehensive market research report for [company_name] in the [industry] industry. Research current market trends, competitor landscape, and growth opportunities. Include specific statistics, recent developments, and actionable insights. Personalize all recommendations based on [company_name]'s size and target market.",
      "step_order": 0,
      "depends_on": [],
      "tools": ["web_search_preview"],
      "tool_choice": "auto"
    },
    {
      "step_name": "Competitor Analysis",
      "step_description": "Analyze competitors in parallel with market research",
      "model": "gpt-4o",
      "instructions": "Research and analyze top 5 competitors for [company_name] in the [industry] industry. Include their strengths, weaknesses, and market positioning.",
      "step_order": 0,
      "depends_on": [],
      "tools": ["web_search_preview"],
      "tool_choice": "auto"
    },
    {
      "step_name": "SWOT Analysis",
      "step_description": "Create SWOT analysis based on research findings",
      "model": "gpt-5",
      "instructions": "Using insights from Step 1 (Deep Research) and Step 2 (Competitor Analysis), create a comprehensive SWOT analysis for [company_name]. Focus on opportunities and threats specific to the [industry] industry.",
      "step_order": 1,
      "depends_on": [0, 1],
      "tools": [],
      "tool_choice": "none"
    },
    {
      "step_name": "HTML Formatting",
      "step_description": "Format research content into styled HTML matching template",
      "model": "gpt-5",
      "instructions": "Transform the research content from previous steps into a beautifully formatted HTML document that matches the provided template. Preserve all research findings, statistics, and insights. Ensure the HTML is accessible, mobile-responsive, and maintains the template's design structure.",
      "step_order": 2,
      "depends_on": [2],
      "tools": [],
      "tool_choice": "none"
    }
  ]
}
\`\`\`

## Return Format

Return ONLY valid JSON matching this structure:
\`\`\`json
{
  "workflow_name": "...",
  "workflow_description": "...",
  "steps": [
    {
      "step_name": "...",
      "step_description": "...",
      "model": "...",
      "instructions": "Detailed, specific instructions with [field_name] references",
      "step_order": 0,
      "depends_on": [],  // Array of step indices this step depends on (optional, auto-detected from step_order if not provided)
      "tools": ["..."],
      "tool_choice": "auto|required|none"
    }
  ]
}
\`\`\`

Important: Return ONLY the JSON, no markdown formatting, no explanations.`;

    console.log('[Workflow Generation] Calling OpenAI for workflow generation...');
    const workflowStartTime = Date.now();
    
    const workflowCompletionParams: any = {
      model,
      instructions: 'You are an expert at creating AI-powered lead magnets. Return only valid JSON without markdown formatting.',
      input: workflowPrompt,
    };
    if (model !== 'gpt-5') {
      workflowCompletionParams.temperature = 0.7;
    }
    const workflowCompletion = await callResponsesWithTimeout(
      () => this.openai.responses.create(workflowCompletionParams),
      'workflow generation'
    );

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
      const inputTokens = workflowUsage.input_tokens || 0;
      const outputTokens = workflowUsage.output_tokens || 0;
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

    // Validate response has output_text
    if (!workflowCompletion.output_text) {
      throw new Error('OpenAI Responses API returned empty response. output_text is missing.');
    }
    
    const workflowContent = workflowCompletion.output_text;
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
              depends_on: step.depends_on !== undefined ? step.depends_on : undefined, // Preserve depends_on if provided
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
    
    const templateCompletionParams: any = {
      model,
      instructions: 'You are an expert HTML template designer. Return only valid HTML code without markdown formatting.',
      input: templatePrompt,
    };
    if (model !== 'gpt-5') {
      templateCompletionParams.temperature = 0.7;
    }
    const templateCompletion = await callResponsesWithTimeout(
      () => this.openai.responses.create(templateCompletionParams),
      'template HTML generation'
    );

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
      const inputTokens = templateUsage.input_tokens || 0;
      const outputTokens = templateUsage.output_tokens || 0;
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

    // Validate response has output_text
    if (!templateCompletion.output_text) {
      throw new Error('OpenAI Responses API returned empty response. output_text is missing for template HTML generation.');
    }
    
    let cleanedHtml = templateCompletion.output_text;
    
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
    
    const templateNameCompletionParams: any = {
      model,
      input: templateNamePrompt,
    };
    if (model !== 'gpt-5') {
      templateNameCompletionParams.temperature = 0.5;
    }
    const templateNameCompletion = await callResponsesWithTimeout(
      () => this.openai.responses.create(templateNameCompletionParams),
      'template name generation'
    );

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
      const inputTokens = templateNameUsage.input_tokens || 0;
      const outputTokens = templateNameUsage.output_tokens || 0;
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

    // Validate response has output_text
    if (!templateNameCompletion.output_text) {
      throw new Error('OpenAI Responses API returned empty response. output_text is missing for template name generation.');
    }
    
    const templateNameContent = templateNameCompletion.output_text;
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
    
    const formCompletionParams: any = {
      model,
      instructions: 'You are an expert at creating lead capture forms. Return only valid JSON without markdown formatting.',
      input: formPrompt,
    };
    if (model !== 'gpt-5') {
      formCompletionParams.temperature = 0.7;
    }
    const formCompletion = await callResponsesWithTimeout(
      () => this.openai.responses.create(formCompletionParams),
      'form generation'
    );

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
      const inputTokens = formUsage.input_tokens || 0;
      const outputTokens = formUsage.output_tokens || 0;
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

    // Validate response has output_text
    if (!formCompletion.output_text) {
      throw new Error('OpenAI Responses API returned empty response. output_text is missing for form generation.');
    }
    
    const formContent = formCompletion.output_text;
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

