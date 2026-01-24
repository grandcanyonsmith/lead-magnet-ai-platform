import { buildWorkflowPrompt } from "@domains/workflows/services/workflow/workflowPromptService";
import {
  buildStepSystemPrompt,
} from "@domains/workflows/services/workflowStepAIService";
import {
  buildWorkflowAiSystemPrompt,
} from "@domains/workflows/services/workflowAIService";
import type { ToolChoice } from "@utils/types";
import { PROMPT_OVERRIDE_KEYS, type PromptOverrideKey } from "./promptOverrides";
import {
  WORKFLOW_STEP_PROMPT,
  WORKFLOW_EDIT_PROMPT,
  WORKFLOW_INSTRUCTIONS_REFINE_PROMPT,
  TEMPLATE_HTML_PROMPT,
  TEMPLATE_METADATA_PROMPT,
  HTML_PATCH_INSTRUCTIONS,
  HTML_PATCH_PROMPT,
  FORM_FIELD_PROMPT,
  FORM_CSS_PROMPT,
  FORM_CSS_REFINE_PROMPT,
  EXECUTION_STEP_EDIT_INSTRUCTIONS,
  EXECUTION_STEP_EDIT_PROMPT,
  FILE_SEARCH_ASSISTANT_INSTRUCTIONS,
  FILE_SEARCH_SIMPLE_INSTRUCTIONS,
  FILE_SEARCH_SIMPLE_PROMPT,
  STYLED_HTML_INSTRUCTIONS,
  STYLED_HTML_PROMPT,
  IMAGE_PROMPT_PLANNER_INSTRUCTIONS,
  IMAGE_PROMPT_PLANNER_PROMPT,
  SHELL_TOOL_LOOP_INSTRUCTIONS,
  PROMPT_CONFIGS,
} from "@config/prompts";

export type PromptDefault = {
  instructions?: string;
  prompt?: string;
  model?: string;
  tools?: any[]; // Using any[] to avoid complex type imports for now, or import ToolConfig
  tool_choice?: ToolChoice;
  service_tier?: string;
  reasoning_effort?: string;
  text_verbosity?: string;
};

export type PromptDefaults = Record<PromptOverrideKey, PromptDefault>;

const WORKFLOW_GENERATION_PROMPT = buildWorkflowPrompt({
  description: "{{description}}",
  brandContext: "{{brand_context}}",
  icpContext: "{{icp_context}}",
  defaultToolChoice: "required",
  defaultServiceTier: "auto",
  defaultTextVerbosity: undefined,
});

const WORKFLOW_STEP_INSTRUCTIONS = buildStepSystemPrompt(
  "required" as ToolChoice,
  "auto",
  undefined,
);

const WORKFLOW_EDIT_INSTRUCTIONS = buildWorkflowAiSystemPrompt(
  "required" as ToolChoice,
  "auto",
  undefined,
);

const PROMPT_DEFAULTS: PromptDefaults = {
  workflow_generation: {
    instructions:
      "You are an expert AI Lead Magnet Architect. Return only valid JSON without markdown formatting.",
    prompt: WORKFLOW_GENERATION_PROMPT,
    ...PROMPT_CONFIGS.workflow_generation,
  },
  workflow_step_generation: {
    instructions: WORKFLOW_STEP_INSTRUCTIONS,
    prompt: WORKFLOW_STEP_PROMPT,
    ...PROMPT_CONFIGS.workflow_step_generation,
  },
  workflow_edit: {
    instructions: WORKFLOW_EDIT_INSTRUCTIONS,
    prompt: WORKFLOW_EDIT_PROMPT,
    ...PROMPT_CONFIGS.workflow_edit,
  },
  workflow_instructions_refine: {
    instructions:
      "You are an expert AI prompt engineer. Return only the modified instructions without markdown formatting.",
    prompt: WORKFLOW_INSTRUCTIONS_REFINE_PROMPT,
    ...PROMPT_CONFIGS.workflow_instructions_refine,
  },
  template_html_generation: {
    instructions:
      "You are an expert HTML template designer. Return only valid HTML code without markdown formatting.",
    prompt: TEMPLATE_HTML_PROMPT,
    ...PROMPT_CONFIGS.template_html_generation,
  },
  template_metadata_generation: {
    prompt: TEMPLATE_METADATA_PROMPT,
    ...PROMPT_CONFIGS.template_metadata_generation,
  },
  html_patch: {
    instructions: HTML_PATCH_INSTRUCTIONS,
    prompt: HTML_PATCH_PROMPT,
    ...PROMPT_CONFIGS.html_patch,
  },
  form_field_generation: {
    instructions:
      "You are an expert at creating lead capture forms. Return only valid JSON without markdown formatting.",
    prompt: FORM_FIELD_PROMPT,
    ...PROMPT_CONFIGS.form_field_generation,
  },
  form_css_generation: {
    instructions:
      "You are a Senior UI/UX Designer. Return only valid CSS code without markdown formatting.",
    prompt: FORM_CSS_PROMPT,
    ...PROMPT_CONFIGS.form_css_generation,
  },
  form_css_refine: {
    instructions:
      "You are a Senior UI/UX Designer. Return only valid CSS code without markdown formatting.",
    prompt: FORM_CSS_REFINE_PROMPT,
    ...PROMPT_CONFIGS.form_css_refine,
  },
  execution_step_edit: {
    instructions: EXECUTION_STEP_EDIT_INSTRUCTIONS,
    prompt: EXECUTION_STEP_EDIT_PROMPT,
    ...PROMPT_CONFIGS.execution_step_edit,
  },
  file_search_assistant: {
    instructions: FILE_SEARCH_ASSISTANT_INSTRUCTIONS,
    prompt: "{{query}}",
    ...PROMPT_CONFIGS.file_search_assistant,
  },
  file_search_simple: {
    instructions: FILE_SEARCH_SIMPLE_INSTRUCTIONS,
    prompt: FILE_SEARCH_SIMPLE_PROMPT,
    ...PROMPT_CONFIGS.file_search_simple,
  },
  styled_html_generation: {
    instructions: STYLED_HTML_INSTRUCTIONS,
    prompt: STYLED_HTML_PROMPT,
    ...PROMPT_CONFIGS.styled_html_generation,
  },
  image_prompt_planner: {
    instructions: IMAGE_PROMPT_PLANNER_INSTRUCTIONS,
    prompt: IMAGE_PROMPT_PLANNER_PROMPT,
    ...PROMPT_CONFIGS.image_prompt_planner,
  },
  shell_tool_loop_default: {
    instructions: SHELL_TOOL_LOOP_INSTRUCTIONS,
    prompt: "{{input}}",
    ...PROMPT_CONFIGS.shell_tool_loop_default,
  },
  workflow_ideation: {
    instructions: IDEATION_SYSTEM_PROMPT,
    prompt: "{{input}}",
    ...PROMPT_CONFIGS.workflow_ideation,
  },
  workflow_ideation_followup: {
    instructions: FOLLOWUP_SYSTEM_PROMPT,
    prompt: "{{input}}",
    ...PROMPT_CONFIGS.workflow_ideation_followup,
  },
};

export const getPromptDefaults = (): PromptDefaults => {
  return PROMPT_OVERRIDE_KEYS.reduce((acc, key) => {
    acc[key] = PROMPT_DEFAULTS[key];
    return acc;
  }, {} as PromptDefaults);
};
