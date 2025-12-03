/**
 * Model descriptions for workflow-related AI guidance.
 */

export const MODEL_DESCRIPTIONS_SHORT: Record<string, string> = {
  'gpt-5': 'For creative content, rewriting, general tasks (highest quality)',
  'gpt-4o': 'For balanced performance and quality',
  'gpt-4o-mini': 'For cost-effective tasks with good quality',
  'o4-mini-deep-research': 'For deep research tasks requiring comprehensive analysis',
};

export interface ModelDescription {
  bestFor: string;
  useWhen: string;
  cost: string;
  speed: string;
}

export const MODEL_DESCRIPTIONS_DETAILED: Record<string, ModelDescription> = {
  'gpt-5': {
    bestFor: 'High-quality content generation, HTML rewriting, general-purpose tasks',
    useWhen: 'You need the best quality output for content generation',
    cost: 'Higher cost, premium quality',
    speed: 'Moderate',
  },
  'gpt-4.1': {
    bestFor: 'High-quality content with Code Interpreter support',
    useWhen: 'You need code execution capabilities with high quality',
    cost: 'Moderate-high',
    speed: 'Moderate',
  },
  'gpt-4o': {
    bestFor: 'General-purpose content generation, balanced quality and cost',
    useWhen: 'Good quality is needed but cost is a consideration',
    cost: 'Moderate',
    speed: 'Fast',
  },
  'gpt-4-turbo': {
    bestFor: 'Faster content generation with good quality',
    useWhen: 'Speed is important and quality is acceptable',
    cost: 'Moderate',
    speed: 'Very fast',
  },
  'gpt-3.5-turbo': {
    bestFor: 'Cost-effective content generation',
    useWhen: 'Cost is primary concern and basic quality is acceptable',
    cost: 'Low',
    speed: 'Very fast',
  },
  'o4-mini-deep-research': {
    bestFor: 'Deep research tasks requiring comprehensive analysis',
    useWhen: 'You need thorough research and detailed analysis',
    cost: 'Moderate',
    speed: 'Moderate (slower due to research depth)',
  },
};

export function formatModelDescriptionMarkdown(model: string, description: ModelDescription): string {
  return `### ${model}
- **Best for**: ${description.bestFor}
- **Use when**: ${description.useWhen}
- **Cost**: ${description.cost}
- **Speed**: ${description.speed}`;
}

export function formatAllModelDescriptionsMarkdown(): string {
  return Object.entries(MODEL_DESCRIPTIONS_DETAILED)
    .map(([model, description]) => formatModelDescriptionMarkdown(model, description))
    .join('\n\n');
}

export function formatShortModelDescriptionsList(): string {
  return Object.entries(MODEL_DESCRIPTIONS_SHORT)
    .map(([model, description]) => `   - ${model}: ${description}`)
    .join('\n');
}
