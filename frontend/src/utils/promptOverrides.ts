import { PROMPT_OVERRIDE_DEFINITIONS } from "@/constants/promptOverrides";
import type { PromptOverride, PromptOverrides } from "@/types/settings";

export type ParsedOverrides = {
  data?: PromptOverrides;
  error?: string;
};

export type OverrideDraft = {
  enabled: boolean;
  instructions: string;
  prompt: string;
};

export const parsePromptOverrides = (value: string): ParsedOverrides => {
  const trimmed = value.trim();
  if (!trimmed) {
    return { data: {} };
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "Prompt overrides must be a JSON object." };
    }
    return { data: parsed as PromptOverrides };
  } catch {
    return { error: "Prompt overrides must be valid JSON." };
  }
};

export const getOverrideStatus = ({
  override,
  hasText,
}: {
  override?: PromptOverride;
  hasText: boolean;
}) => {
  const hasEnabledFlag = typeof override?.enabled === "boolean";
  const hasOverride = hasText || hasEnabledFlag;
  if (!hasOverride) {
    return {
      label: "Default",
      variant: "secondary" as const,
      description: "Using the default prompt.",
    };
  }
  if (override?.enabled === false) {
    return {
      label: "Disabled",
      variant: "warning" as const,
      description: "Override is disabled; defaults are used.",
    };
  }
  return {
    label: "Override",
    variant: "success" as const,
    description: "Override is active.",
  };
};

export const getEmptyFieldLabel = (isDisabled: boolean, label: string) => {
  if (isDisabled) {
    return `Override disabled. Default ${label} is used.`;
  }
  return `Using default ${label}.`;
};

export const orderOverrides = (overrides: PromptOverrides): PromptOverrides => {
  const ordered: PromptOverrides = {};
  const knownKeys = new Set<string>(
    PROMPT_OVERRIDE_DEFINITIONS.map((item) => item.key),
  );
  PROMPT_OVERRIDE_DEFINITIONS.forEach((item) => {
    if (overrides[item.key]) {
      ordered[item.key] = overrides[item.key];
    }
  });
  Object.keys(overrides)
    .filter((key) => !knownKeys.has(key))
    .sort()
    .forEach((key) => {
      ordered[key] = overrides[key];
    });
  return ordered;
};

export const buildOverridePayload = (draft: OverrideDraft): PromptOverride | null => {
  const next: PromptOverride = {};
  const instructions = draft.instructions.trim();
  const prompt = draft.prompt.trim();
  if (instructions) {
    next.instructions = draft.instructions;
  }
  if (prompt) {
    next.prompt = draft.prompt;
  }
  if (!draft.enabled) {
    next.enabled = false;
  }
  return Object.keys(next).length > 0 ? next : null;
};
