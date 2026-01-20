export const PROMPT_OVERRIDE_DEFINITIONS = [
  { key: "workflow_generation", label: "Workflow generation" },
  { key: "workflow_step_generation", label: "Workflow step generation" },
  { key: "workflow_edit", label: "Workflow edit" },
  { key: "workflow_instructions_refine", label: "Workflow instructions refine" },
  { key: "template_html_generation", label: "Template HTML generation" },
  { key: "template_metadata_generation", label: "Template metadata generation" },
  { key: "html_patch", label: "HTML patch" },
  { key: "form_field_generation", label: "Form field generation" },
  { key: "form_css_generation", label: "Form CSS generation" },
  { key: "form_css_refine", label: "Form CSS refine" },
  { key: "execution_step_edit", label: "Execution step edit" },
  { key: "file_search_assistant", label: "File search assistant" },
  { key: "file_search_simple", label: "File search simple" },
  { key: "styled_html_generation", label: "Styled HTML generation" },
  { key: "image_prompt_planner", label: "Image prompt planner" },
  { key: "shell_tool_loop_default", label: "Shell tool loop default" },
] as const;

export type PromptOverrideKey =
  (typeof PROMPT_OVERRIDE_DEFINITIONS)[number]["key"];
