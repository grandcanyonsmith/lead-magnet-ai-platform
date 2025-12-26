/**
 * Model descriptions for workflow-related AI guidance.
 */

export const MODEL_DESCRIPTIONS_SHORT: Record<string, string> = {
  'gpt-5.2': 'For creative content, rewriting, general tasks (highest quality, newer)',
};

export interface ModelDescription {
  bestFor: string;
  useWhen: string;
  cost: string;
  speed: string;
}

export const MODEL_DESCRIPTIONS_DETAILED: Record<string, ModelDescription> = {
  'gpt-5.2': {
    bestFor: 'High-quality content generation, HTML rewriting, general-purpose tasks (latest)',
    useWhen: 'You want the latest GPT-5 family model for best quality output',
    cost: 'Higher cost, premium quality',
    speed: 'Moderate',
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
