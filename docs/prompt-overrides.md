# Prompt Overrides

This project supports tenant-level prompt overrides via the settings field
`prompt_overrides`. Overrides let a user replace default system instructions
and/or prompt templates for specific AI calls.

## Format

`prompt_overrides` is a JSON object keyed by prompt id. Each value can include:

- `enabled` (boolean, optional): Set to `false` to disable the override.
- `instructions` (string, optional): System instructions override.
- `prompt` (string, optional): Input/prompt override.

If an override is missing, empty, or disabled, the default prompt is used.

### Example

```json
{
  "workflow_generation": {
    "instructions": "You are a Workflow Architect. Return valid JSON only.",
    "prompt": "Build a workflow for: {{description}}\n\n{{context_section}}"
  }
}
```

## Template Variables

Prompt strings support `{{variable}}` placeholders. Missing variables are left
as-is so you can spot them in outputs.

### Supported Keys and Variables

- `workflow_generation`
  - `description`, `brand_context`, `icp_context`, `context_section`,
    `default_tool_choice`, `default_service_tier`, `default_text_verbosity`,
    `model_descriptions_markdown`
- `workflow_step_generation`
  - `workflow_name`, `workflow_description`, `context_message`, `user_prompt`,
    `suggested_action`, `current_step_json`, `current_step_index`,
    `default_tool_choice`, `default_service_tier`, `default_text_verbosity`
- `workflow_edit`
  - `workflow_name`, `workflow_description`, `context_message`, `user_prompt`,
    `review_service_tier`, `review_reasoning_effort`, `default_tool_choice`,
    `default_service_tier`, `default_text_verbosity`
- `workflow_instructions_refine`
  - `current_instructions`, `edit_prompt`
- `template_html_generation`
  - `description`, `brand_context`, `icp_context`, `context_section`
- `template_metadata_generation`
  - `description`, `brand_context`, `icp_context`, `context_section`
- `html_patch`
  - `html`, `user_prompt`, `selector`, `selected_outer_html`, `page_url`,
    `input_prompt`
- `form_field_generation`
  - `description`, `workflow_name`, `brand_context`, `icp_context`,
    `context_section`
- `form_css_generation`
  - `css_prompt`, `fields_description`
- `form_css_refine`
  - `css_prompt`, `current_css`
- `execution_step_edit`
  - `step_name`, `step_order`, `user_prompt`, `original_output`
- `file_search_assistant`
  - `query`
- `file_search_simple`
  - `query`, `context`, `file_count`
- `styled_html_generation`
  - `content_label`, `content`, `template_html`, `template_style`,
    `submission_data_json`, `input_text`
- `image_prompt_planner`
  - `step_name`, `step_instructions`, `full_context`, `context`,
    `previous_context`, `planner_input`
- `shell_tool_loop_default`
  - `input`

## Notes

- Overrides apply per-tenant via settings.
- Only the initial input is overridden for `shell_tool_loop_default`.
- Keep prompts concise; very long overrides may increase token usage.
