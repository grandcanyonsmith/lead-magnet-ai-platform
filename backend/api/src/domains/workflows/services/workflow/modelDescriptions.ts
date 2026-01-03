/**
 * Model descriptions for workflow-related AI guidance.
 */

export const MODEL_DESCRIPTIONS_SHORT: Record<string, string> = {
  'gpt-5.2': 'For creative content, rewriting, general tasks (highest quality, newer)',
  'gpt-5.1': 'Balanced performance for standard tasks',
  'gpt-5.1-codex': 'Specialized for code generation and technical content',
  'gpt-5': 'Standard GPT-5 model',
  'gpt-4.1': 'High capability previous generation model',
  'gpt-4-turbo': 'Fast and capable model for complex tasks',
  'gpt-3.5-turbo': 'Fastest, lowest cost model for simple tasks',
  'computer-use-preview': 'Beta model for computer use / browser automation',
  'o4-mini-deep-research': 'Specialized model for deep research tasks',
};

export const AVAILABLE_MODELS = Object.keys(MODEL_DESCRIPTIONS_SHORT);

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
  'gpt-5.1': {
    bestFor: 'Standard content generation, email drafts, summaries',
    useWhen: 'You need good quality but want to save on costs compared to 5.2',
    cost: 'Moderate',
    speed: 'Fast',
  },
  'gpt-5.1-codex': {
    bestFor: 'Code generation, technical documentation, data formatting',
    useWhen: 'The task involves programming concepts or structured data',
    cost: 'Moderate',
    speed: 'Fast',
  },
  'gpt-5': {
    bestFor: 'General purpose tasks',
    useWhen: 'You need a baseline GPT-5 performance',
    cost: 'Moderate',
    speed: 'Moderate',
  },
  'gpt-4.1': {
    bestFor: 'Complex reasoning, legacy compatibility',
    useWhen: 'You prefer the behavior of the GPT-4 series',
    cost: 'High',
    speed: 'Slow',
  },
  'gpt-4-turbo': {
    bestFor: 'Complex tasks requiring larger context window',
    useWhen: 'You have large inputs or need up-to-date knowledge',
    cost: 'Moderate',
    speed: 'Fast',
  },
  'gpt-3.5-turbo': {
    bestFor: 'Simple classifications, quick summaries, chat',
    useWhen: 'Cost and speed are the primary concerns',
    cost: 'Low',
    speed: 'Very Fast',
  },
  'computer-use-preview': {
    bestFor: 'Browser automation, interacting with websites, complex UI tasks',
    useWhen: 'You need to perform actions on websites or use computer interfaces',
    cost: 'High',
    speed: 'Slow (Multi-step)',
  },
  'o4-mini-deep-research': {
    bestFor: 'Deep research, gathering comprehensive information',
    useWhen: 'You need to research a topic thoroughly before generating content',
    cost: 'Variable',
    speed: 'Slow (Multi-step)',
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
