import { formatAllModelDescriptionsMarkdown } from './modelDescriptions';
import { ToolChoice } from '@utils/types';
import { WORKFLOW_GENERATION_SYSTEM_PROMPT } from '@config/prompts';

export interface WorkflowPromptContext {
  description: string;
  brandContext?: string;
  icpContext?: string;
  defaultToolChoice?: ToolChoice;
  defaultServiceTier?: string;
  defaultTextVerbosity?: string;
}

export function buildWorkflowPrompt(context: WorkflowPromptContext): string {
  const {
    description,
    brandContext,
    icpContext,
    defaultToolChoice,
    defaultServiceTier,
    defaultTextVerbosity,
  } = context;
  const resolvedDefaultToolChoice =
    defaultToolChoice === "auto" || defaultToolChoice === "required" || defaultToolChoice === "none"
      ? defaultToolChoice
      : "required";
  const resolvedDefaultServiceTier =
    defaultServiceTier === "auto" ||
    defaultServiceTier === "default" ||
    defaultServiceTier === "flex" ||
    defaultServiceTier === "scale" ||
    defaultServiceTier === "priority"
      ? defaultServiceTier
      : "auto";
  const resolvedDefaultTextVerbosity =
    defaultTextVerbosity === "low" ||
    defaultTextVerbosity === "medium" ||
    defaultTextVerbosity === "high"
      ? defaultTextVerbosity
      : undefined;

  let contextSection = '';
  if (brandContext) {
    contextSection += `\n\n## Brand Context\n${brandContext}`;
  }
  if (icpContext) {
    contextSection += `\n\n## Ideal Customer Profile (ICP) Document\n${icpContext}`;
  }

  const serviceTierSection = resolvedDefaultServiceTier
    ? `\n## Default Service Tier\n- Use **"${resolvedDefaultServiceTier}"** for each step unless the user explicitly asks for a different tier.`
    : "";

  const textVerbositySection = resolvedDefaultTextVerbosity
    ? `\n## Default Output Verbosity\n- Use **"${resolvedDefaultTextVerbosity}"** verbosity for each step unless the user explicitly asks for a different level.`
    : "";

  return WORKFLOW_GENERATION_SYSTEM_PROMPT
    .replace('{{description}}', description)
    .replace('{{context_section}}', contextSection)
    .replace('{{resolvedDefaultToolChoice}}', resolvedDefaultToolChoice)
    .replace('{{service_tier_section}}', serviceTierSection)
    .replace('{{text_verbosity_section}}', textVerbositySection);
}

export const workflowPromptService = {
  buildWorkflowPrompt,
};

export type WorkflowPromptService = typeof workflowPromptService;
