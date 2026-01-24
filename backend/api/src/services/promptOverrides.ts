/**
 * Prompt override utilities.
 * 
 * Handles merging tenant-specific prompt overrides with the system defaults.
 * System defaults are typically imported from `@config/prompts`.
 */
import { ToolChoice, ToolConfig } from "../utils/types";
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
  "workflow_ideation",
  "workflow_ideation_followup",
] as const;

export type PromptOverrideKey = typeof PROMPT_OVERRIDE_KEYS[number];

export type PromptOverride = {
  enabled?: boolean;
  instructions?: string;
  prompt?: string;
  model?: string;
  tools?: ToolConfig[];
  tool_choice?: ToolChoice;
  service_tier?: string;
  reasoning_effort?: string;
  text_verbosity?: string;
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
    const model = coercePromptText(override.model);
    const tools = Array.isArray(override.tools)
      ? (override.tools as ToolConfig[])
      : undefined;
    const tool_choice = coercePromptText(override.tool_choice) as
      | ToolChoice
      | undefined;
    const service_tier = coercePromptText(override.service_tier);
    const reasoning_effort = coercePromptText(override.reasoning_effort);
    const text_verbosity = coercePromptText(override.text_verbosity);

    if (
      instructions ||
      prompt ||
      enabled !== undefined ||
      model ||
      tools ||
      tool_choice ||
      service_tier ||
      reasoning_effort ||
      text_verbosity
    ) {
      normalized[key] = {
        ...(enabled !== undefined ? { enabled } : {}),
        ...(instructions ? { instructions } : {}),
        ...(prompt ? { prompt } : {}),
        ...(model ? { model } : {}),
        ...(tools ? { tools } : {}),
        ...(tool_choice ? { tool_choice } : {}),
        ...(service_tier ? { service_tier } : {}),
        ...(reasoning_effort ? { reasoning_effort } : {}),
        ...(text_verbosity ? { text_verbosity } : {}),
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
  defaults: PromptOverride;
  overrides?: PromptOverrides;
  variables?: Record<string, string | undefined>;
}): PromptOverride => {
  const override = overrides?.[key];
  const isEnabled = override?.enabled !== false;

  const instructions =
    isEnabled && override?.instructions
      ? override.instructions
      : defaults.instructions;
  const prompt =
    isEnabled && override?.prompt ? override.prompt : defaults.prompt;
  
  const model = isEnabled && override?.model ? override.model : defaults.model;
  const tools = isEnabled && override?.tools ? override.tools : defaults.tools;
  const tool_choice =
    isEnabled && override?.tool_choice
      ? override.tool_choice
      : defaults.tool_choice;
  const service_tier =
    isEnabled && override?.service_tier
      ? override.service_tier
      : defaults.service_tier;
  const reasoning_effort =
    isEnabled && override?.reasoning_effort
      ? override.reasoning_effort
      : defaults.reasoning_effort;
  const text_verbosity =
    isEnabled && override?.text_verbosity
      ? override.text_verbosity
      : defaults.text_verbosity;

  return {
    instructions: applyPromptTemplate(instructions, variables),
    prompt: applyPromptTemplate(prompt, variables),
    model,
    tools,
    tool_choice,
    service_tier,
    reasoning_effort,
    text_verbosity,
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
