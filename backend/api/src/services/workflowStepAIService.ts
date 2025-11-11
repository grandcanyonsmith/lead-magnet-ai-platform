import OpenAI from 'openai';
import { WorkflowStep } from '../utils/workflowMigration';

export interface AIStepGenerationRequest {
  userPrompt: string;
  action?: 'update' | 'add';
  workflowContext: {
    workflow_id: string;
    workflow_name: string;
    workflow_description: string;
    current_steps: Array<{
      step_name: string;
      step_description?: string;
      model: string;
      tools?: any[];
    }>;
  };
  currentStep?: WorkflowStep;
  currentStepIndex?: number;
}

export interface AIStepGenerationResponse {
  action: 'update' | 'add';
  step_index?: number;
  step: WorkflowStep;
}

const AVAILABLE_MODELS = [
  'gpt-5',
  'o3-deep-research',
  'gpt-4o',
  'gpt-4o-mini',
  'claude-3-7-sonnet-20250219',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
];

const AVAILABLE_TOOLS = [
  'web_search_preview',
  'code_interpreter',
  'computer_use_preview',
  'image_generation',
];

const AI_STEP_SYSTEM_PROMPT = `You are an AI assistant that helps users configure workflow steps for an AI-powered lead magnet generation platform.

The user will describe what they want a workflow step to do in natural language. Your job is to generate a properly structured workflow step configuration.

Available Models:
${AVAILABLE_MODELS.join(', ')}

Available Tools:
- web_search_preview: For web research and information gathering
- code_interpreter: For data analysis, calculations, file processing
- computer_use_preview: For browser automation and UI interaction
- image_generation: For generating images with DALL-E

Tool Choice Options:
- "auto": Let the model decide when to use tools
- "required": Force the model to use at least one tool
- "none": Disable tool usage

You must respond with a JSON object that follows this schema:
{
  "action": "update" | "add",
  "step_index": number | undefined,
  "step": {
    "step_name": string,
    "step_description": string,
    "model": string,
    "instructions": string,
    "tools": string[],
    "tool_choice": "auto" | "required" | "none",
    "depends_on": number[] | undefined
  }
}

Guidelines:
1. Choose the most appropriate model based on the task:
   - o3-deep-research: For comprehensive research tasks
   - gpt-5: For creative content, rewriting, general tasks
   - claude-3-7-sonnet: For complex reasoning and long-form content
   - gpt-4o/gpt-4o-mini: For balanced performance tasks

2. Select tools based on what the step needs to accomplish:
   - Research/data gathering: web_search_preview
   - Data analysis/calculations: code_interpreter
   - Browser interaction: computer_use_preview
   - Image creation: image_generation

3. Write clear, specific instructions that tell the AI model exactly what to do

4. If the user wants to modify an existing step, use action: "update"
   If they want to add a new step, use action: "add"

5. For dependencies, consider if this step needs output from previous steps

6. Keep step names concise but descriptive (max 50 characters)

7. Make step descriptions clear about the purpose (max 150 characters)`;

export class WorkflowStepAIService {
  constructor(private openaiClient: OpenAI) {}

  async generateStep(request: AIStepGenerationRequest): Promise<AIStepGenerationResponse> {
    const { userPrompt, action, workflowContext, currentStep, currentStepIndex } = request;

    // Build context message for AI
    const contextParts: string[] = [
      `Workflow: ${workflowContext.workflow_name}`,
      `Description: ${workflowContext.workflow_description}`,
      '',
      'Current Steps:',
    ];

    if (workflowContext.current_steps.length === 0) {
      contextParts.push('(No steps yet)');
    } else {
      workflowContext.current_steps.forEach((step, index) => {
        const tools = step.tools && step.tools.length > 0 
          ? ` [Tools: ${step.tools.map(t => typeof t === 'string' ? t : t.type).join(', ')}]`
          : '';
        contextParts.push(
          `${index + 1}. ${step.step_name} (${step.model})${tools}${
            step.step_description ? ` - ${step.step_description}` : ''
          }`
        );
      });
    }

    if (currentStep && currentStepIndex !== undefined) {
      contextParts.push('');
      contextParts.push(`Editing Step ${currentStepIndex + 1}:`);
      contextParts.push(JSON.stringify(currentStep, null, 2));
    }

    const contextMessage = contextParts.join('\n');

    // Determine default action
    const suggestedAction = action || (currentStep ? 'update' : 'add');

    const userMessage = `${contextMessage}

User Request: ${userPrompt}

Suggested Action: ${suggestedAction}

Please generate the workflow step configuration.`;

    console.log('[WorkflowStepAI] Generating step', {
      workflow: workflowContext.workflow_name,
      userPrompt: userPrompt.substring(0, 100),
      action: suggestedAction,
    });

    try {
      const completion = await this.openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: AI_STEP_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('No response from OpenAI');
      }

      const parsedResponse = JSON.parse(responseContent) as AIStepGenerationResponse;

      // Validate the response
      if (!parsedResponse.step || !parsedResponse.step.step_name || !parsedResponse.step.instructions) {
        throw new Error('Invalid response structure from AI');
      }

      // Validate model
      if (!AVAILABLE_MODELS.includes(parsedResponse.step.model)) {
        console.warn(`[WorkflowStepAI] Invalid model ${parsedResponse.step.model}, defaulting to gpt-5`);
        parsedResponse.step.model = 'gpt-5';
      }

      // Validate and sanitize tools
      if (parsedResponse.step.tools) {
        parsedResponse.step.tools = parsedResponse.step.tools.filter((tool: any) => {
          const toolName = typeof tool === 'string' ? tool : tool.type;
          return AVAILABLE_TOOLS.includes(toolName);
        });
      }

      // Validate tool_choice
      if (!['auto', 'required', 'none'].includes(parsedResponse.step.tool_choice || '')) {
        parsedResponse.step.tool_choice = 'auto';
      }

      // Set action
      parsedResponse.action = parsedResponse.action || suggestedAction;

      // Set step_index for updates
      if (parsedResponse.action === 'update' && currentStepIndex !== undefined) {
        parsedResponse.step_index = currentStepIndex;
      }

      console.log('[WorkflowStepAI] Step generated successfully', {
        action: parsedResponse.action,
        stepName: parsedResponse.step.step_name,
        model: parsedResponse.step.model,
        tools: parsedResponse.step.tools,
      });

      return parsedResponse;
    } catch (error: any) {
      console.error('[WorkflowStepAI] Error generating step', {
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to generate step: ${error.message}`);
    }
  }
}
