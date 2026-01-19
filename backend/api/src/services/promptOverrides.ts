import { db } from "../utils/db";
import { env } from "../utils/env";

export const PROMPT_OVERRIDE_KEYS = [
  "workflow_generation",
  "workflow_step_generation",
  "workflow_edit",
  "workflow_instructions_refine",
  "template_html_generation",
  "template_metadata_generation",
  "html_patch",
  "form_field_generation",
  "form_css_generation",
  "form_css_refine",
  "execution_step_edit",
  "file_search_assistant",
  "file_search_simple",
  "styled_html_generation",
  "image_prompt_planner",
  "shell_tool_loop_default",
] as const;

export type PromptOverrideKey = typeof PROMPT_OVERRIDE_KEYS[number];

export type PromptOverride = {
  enabled?: boolean;
  instructions?: string;
  prompt?: string;
};

export type PromptOverrides = Record<string, PromptOverride>;

const USER_SETTINGS_TABLE = env.userSettingsTable;

const coercePromptText = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return value;
};

export const normalizePromptOverrides = (
  raw: unknown,
): PromptOverrides | undefined => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }

  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length === 0) return {};

  const normalized: PromptOverrides = {};
  for (const [key, value] of entries) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    const override = value as Record<string, unknown>;
    const instructions = coercePromptText(override.instructions);
    const prompt = coercePromptText(override.prompt);
    const enabled =
      typeof override.enabled === "boolean" ? override.enabled : undefined;

    if (instructions || prompt || enabled !== undefined) {
      normalized[key] = {
        ...(enabled !== undefined ? { enabled } : {}),
        ...(instructions ? { instructions } : {}),
        ...(prompt ? { prompt } : {}),
      };
    }
  }

  return normalized;
};

export const applyPromptTemplate = (
  template: string | undefined,
  variables: Record<string, string | undefined>,
): string | undefined => {
  if (!template) return template;

  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key) => {
    const value = variables[key];
    if (value === undefined || value === null) {
      return match;
    }
    return String(value);
  });
};

export const resolvePromptOverride = ({
  key,
  defaults,
  overrides,
  variables = {},
}: {
  key: PromptOverrideKey;
  defaults: { instructions?: string; prompt?: string };
  overrides?: PromptOverrides;
  variables?: Record<string, string | undefined>;
}): { instructions?: string; prompt?: string } => {
  const override = overrides?.[key];
  const isEnabled = override?.enabled !== false;

  const instructions = isEnabled && override?.instructions
    ? override.instructions
    : defaults.instructions;
  const prompt = isEnabled && override?.prompt ? override.prompt : defaults.prompt;

  return {
    instructions: applyPromptTemplate(instructions, variables),
    prompt: applyPromptTemplate(prompt, variables),
  };
};

export const getPromptOverridesFromSettings = (
  settings?: Record<string, unknown> | null,
): PromptOverrides | undefined => {
  if (!settings) return undefined;
  return normalizePromptOverrides(settings.prompt_overrides);
};

export const getPromptOverridesForTenant = async (
  tenantId: string,
): Promise<PromptOverrides | undefined> => {
  if (!USER_SETTINGS_TABLE) return undefined;

  const settings = await db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId });
  return getPromptOverridesFromSettings(settings);
};
