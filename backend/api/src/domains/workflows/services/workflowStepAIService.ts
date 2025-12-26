import OpenAI from 'openai';
import { WorkflowStep } from './workflow/workflowConfigSupport';
import { stripMarkdownCodeFences } from '@utils/openaiHelpers';

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
  'gpt-5.2',
];

const AVAILABLE_TOOLS = [
  'web_search',
  'code_interpreter',
  'computer_use_preview',
  'image_generation',
  'shell',
];

const AI_STEP_SYSTEM_PROMPT = `You are an Expert Workflow Architect for an AI Lead Magnet platform.
    
Your goal is to translate the user's natural language request into a precise, high-performance workflow step configuration.

Available Models:
${AVAILABLE_MODELS.join(', ')}

Available Tools:
- **web_search**: Essential for research, finding stats, or competitor analysis.
- **code_interpreter**: Use for calculations, data analysis, or processing files.
- **image_generation**: Use for creating visuals (infographics, covers).
- **computer_use_preview**: (Rare) Only for browser automation.
- **shell**: (Advanced) System commands.

## Guidelines for Excellence

1. **Model Selection**:
   - Use **gpt-5.2** for high-stakes content creation and complex reasoning.
   - Use **o4-mini-deep-research** ONLY if deep, multi-step research is explicitly requested.

2. **Tool Strategy**:
   - **Research Steps**: Almost always need \`web_search\`.
   - **Analysis Steps**: Often need \`code_interpreter\` if data is involved.
   - **Creative Steps**: May need \`image_generation\`.

3. **Instruction Quality**:
   - Write instructions that are **specific** and **actionable**.
   - Assign a **role** (e.g., "Act as a Senior Analyst").
   - Explicitly mention what input data to use.

4. **Response Format**:
   - Return a JSON object matching the schema below.
   - \`step_name\` should be professional and concise.
   - \`step_description\` should clearly state the *value* of the step.

5. **Instruction Hygiene**:
   - Do NOT include "safety disclaimers" about PII (e.g. "Note: you included a phone number...") in the step instructions. The system handles PII securely.
   - Do NOT instruct the model to use [bracketed_placeholders] for missing information in its output. If information is missing, it should be omitted or handled gracefully without placeholders.`;

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
      contextParts.push('');
      contextParts.push('IMPORTANT: If you are not changing the dependencies (depends_on field), you MUST return the existing depends_on array unchanged.');
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
      const completion = await (this.openaiClient as any).responses.create({
        model: 'gpt-5.2',
        instructions: AI_STEP_SYSTEM_PROMPT,
        input: userMessage,
        reasoning: { effort: 'high' },
        service_tier: 'priority',
      });

      const responseContent = stripMarkdownCodeFences(
        String((completion as any)?.output_text || ''),
      ).trim();
      if (!responseContent) {
        throw new Error('No response from OpenAI');
      }

      let parsedResponse: AIStepGenerationResponse;
      try {
        parsedResponse = JSON.parse(responseContent) as AIStepGenerationResponse;
      } catch {
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Invalid response from OpenAI (expected JSON object)');
        }
        parsedResponse = JSON.parse(jsonMatch[0]) as AIStepGenerationResponse;
      }

      // Validate the response
      if (!parsedResponse.step || !parsedResponse.step.step_name || !parsedResponse.step.instructions) {
        throw new Error('Invalid response structure from AI');
      }

      // Validate model
      if (!AVAILABLE_MODELS.includes(parsedResponse.step.model)) {
        console.warn(
          `[WorkflowStepAI] Invalid model ${parsedResponse.step.model}, defaulting to gpt-5.2`,
        );
        parsedResponse.step.model = 'gpt-5.2';
      }

      // Validate and sanitize tools
      if (parsedResponse.step.tools) {
        parsedResponse.step.tools = parsedResponse.step.tools.filter((tool: any) => {
          const toolName = typeof tool === 'string' ? tool : tool.type;
          // Map web_search_preview to web_search (OpenAI sometimes returns preview variant)
          const normalizedTool = toolName === 'web_search_preview' ? 'web_search' : toolName;
          return AVAILABLE_TOOLS.includes(normalizedTool);
        }).map((tool: any) => {
          // Normalize web_search_preview to web_search
          if (typeof tool === 'string' && tool === 'web_search_preview') {
            return 'web_search';
          }
          if (typeof tool === 'object' && tool.type === 'web_search_preview') {
            return { ...tool, type: 'web_search' };
          }
          return tool;
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

      // CRITICAL: Preserve existing dependencies if AI didn't return them
      // This ensures we don't accidentally delete dependency relationships
      if (parsedResponse.action === 'update' && currentStep) {
        // If AI didn't provide depends_on, preserve the original
        if (parsedResponse.step.depends_on === undefined || parsedResponse.step.depends_on === null) {
          parsedResponse.step.depends_on = currentStep.depends_on || [];
          console.log('[WorkflowStepAI] Preserved existing dependencies', {
            depends_on: parsedResponse.step.depends_on,
          });
        }
        
        // Also preserve step_order if not provided
        if (parsedResponse.step.step_order === undefined) {
          parsedResponse.step.step_order = currentStep.step_order;
        }
      }

      console.log('[WorkflowStepAI] Step generated successfully', {
        action: parsedResponse.action,
        stepName: parsedResponse.step.step_name,
        model: parsedResponse.step.model,
        tools: parsedResponse.step.tools,
        depends_on: parsedResponse.step.depends_on,
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
