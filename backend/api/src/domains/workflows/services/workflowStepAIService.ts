import OpenAI from 'openai';
import { WorkflowStep } from './workflow/workflowConfigSupport';
import { ToolChoice } from '@utils/types';
import { stripMarkdownCodeFences } from '@utils/openaiHelpers';
import {
  getPromptOverridesForTenant,
  resolvePromptOverride,
  type PromptOverrides,
} from '@services/promptOverrides';

export interface AIStepGenerationRequest {
  userPrompt: string;
  action?: 'update' | 'add';
  defaultToolChoice?: ToolChoice;
  defaultServiceTier?: string;
  defaultTextVerbosity?: string;
  tenantId?: string;
  promptOverrides?: PromptOverrides;
  workflowContext: {
    workflow_id: string;
    workflow_name: string;
    workflow_description: string;
    current_steps: Array<{
      step_name: string;
      step_description?: string;
      model: string;
      tools?: any[];
      depends_on?: number[];
      step_order?: number;
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

type WorkflowStepAIStreamHandlers = {
  onDelta?: (text: string) => void;
  onEvent?: (event: any) => void;
};

import { AVAILABLE_MODELS } from './workflow/modelDescriptions';

const AVAILABLE_TOOLS = [
  'web_search',
  'code_interpreter',
  'computer_use_preview',
  'image_generation',
  'shell',
];

const DEFAULT_TOOL_CHOICE: ToolChoice = 'required';
const VALID_TOOL_CHOICES = new Set<ToolChoice>(['auto', 'required', 'none']);
const VALID_SERVICE_TIERS = new Set(['auto', 'default', 'flex', 'scale', 'priority']);
const VALID_TEXT_VERBOSITIES = new Set(['low', 'medium', 'high']);

export const buildStepSystemPrompt = (
  defaultToolChoice: ToolChoice,
  defaultServiceTier?: string,
  defaultTextVerbosity?: string,
) => `You are an Expert Workflow Architect for an AI Lead Magnet platform.
    
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

2. **Reasoning Effort (Thinking Power)**:
   - **high**: For complex analysis, strategy, persona creation, and final content generation. (Default for most valuable steps).
   - **medium**: For standard summarization or formatting.
   - **low**: For simple tasks.

3. **Tool Strategy & Configuration**:
   - **Research Steps**: Almost always need \`web_search\`.
   - **Analysis Steps**: Often need \`code_interpreter\` if data is involved.
   - **Creative Steps**: May need \`image_generation\`.
   - **Image Generation Config**:
     - If adding \`image_generation\`, you MUST configure it:
     - \`size\`: "1024x1024" (square), "1024x1536" (portrait), "1536x1024" (landscape/wide).
     - \`quality\`: "standard" or "hd".
     - \`format\`: "png" or "jpeg".
     - \`background\`: "opaque" or "transparent" (if logo/icon).

4. **Tool Choice**:
   - **auto**: Model decides.
   - **required**: If the step's SOLE purpose is to use a tool (e.g. "Research X").
   - **none**: If the step is pure text processing or formatting.
   - Default tool_choice: **${defaultToolChoice}** when tools are present.

5. **Default Service Tier**:
   - Use **${defaultServiceTier || "auto"}** for this step unless the user explicitly asks for a different tier.

6. **Default Output Verbosity**:
   - Use **${defaultTextVerbosity || "model default"}** verbosity unless the user explicitly asks for a different level.

7. **Instruction Quality**:
   - Write instructions that are **specific** and **actionable**.
   - Assign a **role** (e.g., "Act as a Senior Analyst").
   - Explicitly mention what input data to use.
   - **CRITICAL AUTONOMY RULE**: The workflow runs with **no user interaction between steps**. Do **NOT** ask questions, request confirmation, or wait for user input. Make reasonable assumptions and proceed.

8. **Response Format**:
   - Return a JSON object matching the schema below.
   - \`step_name\` should be professional and concise.
   - \`step_description\` should clearly state the *value* of the step.
   - \`reasoning_effort\` should be chosen per-step based on complexity ("low" for simple transforms, "high/xhigh" for deep analysis).
   - \`text_verbosity\` should be chosen per-step ("low" for terse outputs, "high" for detailed reports).
   - \`depends_on\`: Array of step indices this step depends on (0-based, first step = 0).
     - Use the index numbers shown in the "Current Steps" list.
     - **CRITICAL**: If this step uses output from previous steps, list their indices here.
     - If this is the first step, use \`[]\`.
     - If inserting a step, ensure dependencies make sense.
     - Only change \`depends_on\` when the user asks to update dependencies or step order.

9. **Instruction Hygiene**:
   - Do NOT include "safety disclaimers" about PII (e.g. "Note: you included a phone number...") in the step instructions. The system handles PII securely.
   - Do NOT instruct the model to use [bracketed_placeholders] for missing information in its output. If information is missing, it should be omitted or handled gracefully without placeholders.

## JSON Output Schema
\`\`\`json
{
  "step": {
    "step_name": "string",
    "step_description": "string",
    "model": "string",
    "service_tier": "auto" | "default" | "flex" | "scale" | "priority",
    "reasoning_effort": "none" | "low" | "medium" | "high" | "xhigh",
    "text_verbosity": "low" | "medium" | "high",
    "max_output_tokens": number,
    "instructions": "string",
    "tools": [
      "string" OR 
      {
        "type": "image_generation",
        "size": "string",
        "quality": "string",
        "format": "string",
        "background": "string"
      }
    ],
    "tool_choice": "auto" | "required" | "none",
    "depends_on": [number] // 0-based indices
  }
}
\`\`\`
`;

export class WorkflowStepAIService {
  constructor(private openaiClient: OpenAI) {}

  private async buildGenerationContext(request: AIStepGenerationRequest) {
    const {
      userPrompt,
      action,
      workflowContext,
      currentStep,
      currentStepIndex,
      defaultToolChoice,
      defaultServiceTier,
      defaultTextVerbosity,
      tenantId,
      promptOverrides,
    } = request;
    const resolvedDefaultToolChoice = VALID_TOOL_CHOICES.has(defaultToolChoice as ToolChoice)
      ? (defaultToolChoice as ToolChoice)
      : DEFAULT_TOOL_CHOICE;
    const resolvedDefaultServiceTier =
      defaultServiceTier && VALID_SERVICE_TIERS.has(defaultServiceTier)
        ? defaultServiceTier
        : undefined;
    const shouldOverrideServiceTier =
      resolvedDefaultServiceTier !== undefined &&
      resolvedDefaultServiceTier !== "auto";
    const resolvedDefaultTextVerbosity =
      defaultTextVerbosity && VALID_TEXT_VERBOSITIES.has(defaultTextVerbosity)
        ? defaultTextVerbosity
        : undefined;

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
        const dependsOn = Array.isArray(step.depends_on)
          ? ` [depends_on: ${step.depends_on.length > 0 ? step.depends_on.join(', ') : '[]'}]`
          : ' [depends_on: []]';
        const orderSuffix =
          typeof step.step_order === "number" && step.step_order !== index
            ? ` [order: ${step.step_order}]`
            : '';
        contextParts.push(
          `Index ${index} (Step ${index + 1}): ${step.step_name} (${step.model})${tools}${dependsOn}${orderSuffix}${
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
      contextParts.push('IMPORTANT: depends_on uses 0-based indices matching the "Current Steps" list.');
      contextParts.push('If you are not changing dependencies, return the existing depends_on array unchanged.');
    }

    const contextMessage = contextParts.join('\n');

    // Determine default action
    const suggestedAction = action || (currentStep ? 'update' : 'add');

    const userMessage = `${contextMessage}

User Request: ${userPrompt}

Suggested Action: ${suggestedAction}

Please generate the workflow step configuration.`;

    const overrides =
      promptOverrides ?? (tenantId ? await getPromptOverridesForTenant(tenantId) : undefined);
    const resolved = resolvePromptOverride({
      key: "workflow_step_generation",
      defaults: {
        instructions: buildStepSystemPrompt(
          resolvedDefaultToolChoice,
          resolvedDefaultServiceTier,
          resolvedDefaultTextVerbosity,
        ),
        prompt: userMessage,
      },
      overrides,
      variables: {
        workflow_name: workflowContext.workflow_name,
        workflow_description: workflowContext.workflow_description,
        context_message: contextMessage,
        user_prompt: userPrompt,
        suggested_action: suggestedAction,
        current_step_json: currentStep ? JSON.stringify(currentStep, null, 2) : "",
        current_step_index:
          currentStepIndex !== undefined ? String(currentStepIndex) : undefined,
        default_tool_choice: resolvedDefaultToolChoice,
        default_service_tier: resolvedDefaultServiceTier,
        default_text_verbosity: resolvedDefaultTextVerbosity,
      },
    });

    return {
      userPrompt,
      workflowContext,
      currentStep,
      currentStepIndex,
      suggestedAction,
      resolvedDefaultToolChoice,
      resolvedDefaultServiceTier,
      resolvedDefaultTextVerbosity,
      shouldOverrideServiceTier,
      resolved,
    };
  }

  private parseStepResponse(
    responseContent: string,
    options: {
      suggestedAction: 'update' | 'add';
      currentStep?: WorkflowStep;
      currentStepIndex?: number;
      resolvedDefaultToolChoice: ToolChoice;
      resolvedDefaultServiceTier?: string;
      resolvedDefaultTextVerbosity?: string;
      shouldOverrideServiceTier: boolean;
      workflowContext: AIStepGenerationRequest["workflowContext"];
    },
  ): AIStepGenerationResponse {
    const {
      suggestedAction,
      currentStep,
      currentStepIndex,
      resolvedDefaultToolChoice,
      resolvedDefaultServiceTier,
      resolvedDefaultTextVerbosity,
      shouldOverrideServiceTier,
      workflowContext,
    } = options;

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
    if (!parsedResponse.step.model) {
      parsedResponse.step.model = 'gpt-5.2';
    } else if (!AVAILABLE_MODELS.includes(parsedResponse.step.model)) {
      console.warn(
        `[WorkflowStepAI] Model ${parsedResponse.step.model} not in curated list; using as-is`,
      );
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
    const hasTools =
      Array.isArray(parsedResponse.step.tools) && parsedResponse.step.tools.length > 0;
    if (!VALID_TOOL_CHOICES.has(parsedResponse.step.tool_choice as ToolChoice)) {
      parsedResponse.step.tool_choice = hasTools ? resolvedDefaultToolChoice : 'none';
    }

    // Validate service_tier (optional)
    if (
      (parsedResponse.step as any).service_tier &&
      !VALID_SERVICE_TIERS.has((parsedResponse.step as any).service_tier)
    ) {
      delete (parsedResponse.step as any).service_tier;
    }

    if (shouldOverrideServiceTier) {
      (parsedResponse.step as any).service_tier = resolvedDefaultServiceTier;
    }

    // Validate reasoning_effort
    if (!['none', 'low', 'medium', 'high', 'xhigh'].includes(parsedResponse.step.reasoning_effort || '')) {
      parsedResponse.step.reasoning_effort = 'high';
    }

    const actionToApply = parsedResponse.action || suggestedAction;

    // Validate text_verbosity (optional)
    if (
      parsedResponse.step.text_verbosity &&
      !['low', 'medium', 'high'].includes(parsedResponse.step.text_verbosity)
    ) {
      delete (parsedResponse.step as any).text_verbosity;
    }
    const shouldApplyDefaultTextVerbosity =
      resolvedDefaultTextVerbosity !== undefined &&
      (actionToApply === 'add' || !currentStep?.text_verbosity);
    if (shouldApplyDefaultTextVerbosity) {
      parsedResponse.step.text_verbosity = resolvedDefaultTextVerbosity as any;
    } else if (!parsedResponse.step.text_verbosity && currentStep?.text_verbosity) {
      parsedResponse.step.text_verbosity = currentStep.text_verbosity as any;
    }

    // Validate max_output_tokens (optional)
    if (
      (parsedResponse.step as any).max_output_tokens !== undefined &&
      (typeof (parsedResponse.step as any).max_output_tokens !== 'number' ||
        !Number.isFinite((parsedResponse.step as any).max_output_tokens) ||
        (parsedResponse.step as any).max_output_tokens < 1)
    ) {
      delete (parsedResponse.step as any).max_output_tokens;
    }

    // Set action
    parsedResponse.action = actionToApply;

    // Set step_index for updates
    if (parsedResponse.action === 'update' && currentStepIndex !== undefined) {
      parsedResponse.step_index = currentStepIndex;
    }

    const normalizeDependsOn = (
      deps: any,
      maxIndex: number,
      selfIndex?: number,
    ): number[] | null => {
      if (deps === undefined || deps === null) return null;
      if (!Array.isArray(deps)) return null;
      const filtered = deps.filter(
        (dep) =>
          Number.isInteger(dep) &&
          dep >= 0 &&
          dep < maxIndex &&
          dep !== selfIndex,
      );
      return Array.from(new Set(filtered));
    };

    const maxDependencyIndex = workflowContext.current_steps.length;
    const normalizedDependsOn = normalizeDependsOn(
      parsedResponse.step.depends_on,
      maxDependencyIndex,
      parsedResponse.action === 'update' ? currentStepIndex : undefined,
    );

    if (normalizedDependsOn !== null) {
      parsedResponse.step.depends_on = normalizedDependsOn;
    }

    // CRITICAL: Preserve existing dependencies if AI didn't return them
    // This ensures we don't accidentally delete dependency relationships
    if (parsedResponse.action === 'update' && currentStep) {
      if (normalizedDependsOn === null) {
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
  }

  async generateStep(request: AIStepGenerationRequest): Promise<AIStepGenerationResponse> {
    const context = await this.buildGenerationContext(request);

    console.log('[WorkflowStepAI] Generating step', {
      workflow: context.workflowContext.workflow_name,
      userPrompt: context.userPrompt.substring(0, 100),
      action: context.suggestedAction,
    });

    try {
      const completion = await (this.openaiClient as any).responses.create({
        model: 'gpt-5.2',
        instructions: context.resolved.instructions,
        input: context.resolved.prompt,
        reasoning: { effort: 'high' },
        service_tier: 'priority',
      });

      const responseContent = stripMarkdownCodeFences(
        String((completion as any)?.output_text || ''),
      ).trim();

      return this.parseStepResponse(responseContent, {
        suggestedAction: context.suggestedAction,
        currentStep: context.currentStep,
        currentStepIndex: context.currentStepIndex,
        resolvedDefaultToolChoice: context.resolvedDefaultToolChoice,
        resolvedDefaultServiceTier: context.resolvedDefaultServiceTier,
        resolvedDefaultTextVerbosity: context.resolvedDefaultTextVerbosity,
        shouldOverrideServiceTier: context.shouldOverrideServiceTier,
        workflowContext: context.workflowContext,
      });
    } catch (error: any) {
      console.error('[WorkflowStepAI] Error generating step', {
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to generate step: ${error.message}`);
    }
  }

  async streamGenerateStep(
    request: AIStepGenerationRequest,
    handlers?: WorkflowStepAIStreamHandlers,
  ): Promise<AIStepGenerationResponse> {
    const context = await this.buildGenerationContext(request);

    console.log('[WorkflowStepAI] Streaming step generation', {
      workflow: context.workflowContext.workflow_name,
      userPrompt: context.userPrompt.substring(0, 100),
      action: context.suggestedAction,
    });

    try {
      const stream = await (this.openaiClient as any).responses.create({
        model: 'gpt-5.2',
        instructions: context.resolved.instructions,
        input: context.resolved.prompt,
        reasoning: { effort: 'high' },
        service_tier: 'priority',
        stream: true,
      });

      let outputText = "";
      for await (const event of stream as any) {
        handlers?.onEvent?.(event);
        const eventType = String((event as any)?.type || "");
        if (!eventType.includes("output_text")) {
          continue;
        }
        const delta =
          typeof (event as any)?.delta === "string"
            ? (event as any).delta
            : typeof (event as any)?.text === "string"
              ? (event as any).text
              : undefined;
        if (!delta) {
          continue;
        }
        outputText += delta;
        handlers?.onDelta?.(delta);
      }

      const responseContent = stripMarkdownCodeFences(outputText).trim();
      return this.parseStepResponse(responseContent, {
        suggestedAction: context.suggestedAction,
        currentStep: context.currentStep,
        currentStepIndex: context.currentStepIndex,
        resolvedDefaultToolChoice: context.resolvedDefaultToolChoice,
        resolvedDefaultServiceTier: context.resolvedDefaultServiceTier,
        resolvedDefaultTextVerbosity: context.resolvedDefaultTextVerbosity,
        shouldOverrideServiceTier: context.shouldOverrideServiceTier,
        workflowContext: context.workflowContext,
      });
    } catch (error: any) {
      console.error('[WorkflowStepAI] Error streaming step generation', {
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to generate step: ${error.message}`);
    }
  }
}
