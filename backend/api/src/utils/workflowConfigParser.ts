/**
 * Workflow Config Parser
 * Parses and validates workflow configuration from AI responses.
 */

export interface ParsedWorkflowConfig {
  workflow_name: string;
  workflow_description: string;
  steps: Array<{
    step_name: string;
    step_description: string;
    model: string;
    instructions: string;
    step_order: number;
    depends_on?: number[];
    tools: string[];
    tool_choice: string;
  }>;
}

/**
 * Parse workflow configuration from AI response.
 * Handles both new format (with steps array) and legacy format (with research_instructions).
 */
export function parseWorkflowConfig(content: string, description: string): ParsedWorkflowConfig {
  // Default fallback configuration
  const defaultConfig: ParsedWorkflowConfig = {
    workflow_name: 'Generated Lead Magnet',
    workflow_description: description,
    steps: [
      {
        step_name: 'Deep Research',
        step_description: 'Generate comprehensive research report',
        model: 'gpt-5',
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
    if (!jsonMatch) {
      console.warn('[Workflow Config Parser] No JSON found in response, using defaults');
      return defaultConfig;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // If parsed data has steps, use it (new format)
    if (parsed.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
      return {
        workflow_name: parsed.workflow_name || defaultConfig.workflow_name,
        workflow_description: parsed.workflow_description || defaultConfig.workflow_description,
        steps: parsed.steps.map((step: any, index: number) => ({
          step_name: step.step_name || `Step ${index + 1}`,
          step_description: step.step_description || '',
          model: step.model || 'gpt-5',
          instructions: step.instructions || '',
          step_order: step.step_order !== undefined ? step.step_order : index,
          depends_on: step.depends_on !== undefined ? step.depends_on : undefined,
          tools: step.tools || (index === 0 ? ['web_search_preview'] : []),
          tool_choice: step.tool_choice || (index === 0 ? 'auto' : 'none'),
        })),
      };
    } 
    // Legacy format - convert to steps
    else if (parsed.research_instructions) {
      return {
        workflow_name: parsed.workflow_name || defaultConfig.workflow_name,
        workflow_description: parsed.workflow_description || defaultConfig.workflow_description,
        steps: [
          {
            step_name: 'Deep Research',
            step_description: 'Generate comprehensive research report',
            model: 'gpt-5',
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
    } 
    // Partial update - merge with defaults
    else {
      return {
        ...defaultConfig,
        workflow_name: parsed.workflow_name || defaultConfig.workflow_name,
        workflow_description: parsed.workflow_description || defaultConfig.workflow_description,
      };
    }
  } catch (e) {
    console.warn('[Workflow Config Parser] Failed to parse workflow JSON, using defaults', e);
    return defaultConfig;
  }
}

