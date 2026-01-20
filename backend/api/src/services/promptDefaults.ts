import { buildWorkflowPrompt } from "@domains/workflows/services/workflow/workflowPromptService";
import {
  buildStepSystemPrompt,
} from "@domains/workflows/services/workflowStepAIService";
import {
  buildWorkflowAiSystemPrompt,
} from "@domains/workflows/services/workflowAIService";
import type { ToolChoice } from "@utils/types";
import { PROMPT_OVERRIDE_KEYS, type PromptOverrideKey } from "./promptOverrides";

export type PromptDefault = {
  instructions?: string;
  prompt?: string;
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

const WORKFLOW_STEP_PROMPT = `{{context_message}}

User Request: {{user_prompt}}

Suggested Action: {{suggested_action}}

Please generate the workflow step configuration.`;

const WORKFLOW_EDIT_INSTRUCTIONS = buildWorkflowAiSystemPrompt(
  "required" as ToolChoice,
  "auto",
  undefined,
);

const WORKFLOW_EDIT_PROMPT = `{{context_message}}

User Request: {{user_prompt}}

Please generate the updated workflow configuration with all necessary changes.`;

const WORKFLOW_INSTRUCTIONS_REFINE_PROMPT = `You are an expert AI Prompt Engineer and Lead Magnet Strategist. Your task is to refine the following instruction to be clearer, more actionable, and higher quality, based on the user's request: "{{edit_prompt}}"

Current Instructions:
{{current_instructions}}

## Refinement Philosophy
Great AI outputs come from great instructions. Focus on:
1. **Precision**: Eliminate ambiguity.
2. **Context**: Ensure the AI knows *why* it is doing the task.
3. **Structure**: Force the AI to output in a specific format (Markdown, JSON, etc.).
4. **Data Integration**: Ensure \`[field_name]\` variables are used effectively.

## Quality Standards checklist
- [ ] **Role**: Does it assign a persona? (e.g., "Act as a...")
- [ ] **Task**: Is the primary objective clear?
- [ ] **Input**: Does it reference previous steps or form data?
- [ ] **Constraints**: Are there word counts, style guides, or formatting rules?
- [ ] **Output**: Is the expected format explicitly defined?

## Modification Rules
1. **Respect Intent**: Only apply changes requested by "{{edit_prompt}}".
2. **Upgrade Quality**: If the original was vague, make it specific.
3. **Preserve Variables**: Do NOT remove \`[field_name]\` placeholders unless asked.
4. **No Fluff**: Keep instructions concise but potent.
5. **No PII Disclaimers**: Remove any "safety disclaimers" about phone/email (e.g. "Note: you included a phone number...") from the instructions.
6. **No Missing Info Placeholders**: Ensure the instructions do NOT tell the model to output \`[bracketed_placeholders]\` for missing information.

## Output
Return ONLY the refined instructions text. No explanations, no markdown formatting around the response.`;

const TEMPLATE_HTML_PROMPT = `You are a World-Class UI/UX Designer and Frontend Developer.
Task: Create a stunning, high-converting HTML template for a lead magnet described as: "{{description}}"{{context_section}}

## Design Philosophy
- **Modern & Clean**: Use ample whitespace, professional typography, and a refined color palette.
- **Conversion Focused**: The design should encourage reading and engagement.
- **Mobile-First**: It must look perfect on phones.
- **Brand Aligned**: If brand context is provided, strictly adhere to it.

## Technical Requirements
1. **Valid HTML5**: Semantic tags (<header>, <main>, <article>, <footer>).
2. **Inline CSS**: All styling must be in a <style> block within the <head>. No external links.
3. **Responsive**: Use media queries for mobile/tablet layouts.
4. **Typography**: Use system fonts or import a Google Font in the <style> tag.
5. **No Placeholders**: Use *realistic* sample content (headings, paragraphs, lists) that fits the description.
6. **Structure**:
   - **Hero Section**: Title, subtitle.
   - **Content Body**: Readable width (max-width: 800px), good line-height.
   - **Key Takeaways/Summary Box**: Distinct styling.
   - **Call to Action (CTA)**: A placeholder button or link at the bottom.

## Output
Return ONLY the raw HTML code. No Markdown code blocks.`;

const TEMPLATE_METADATA_PROMPT = `Based on this lead magnet: "{{description}}"{{context_section}}, generate:
1. A short, descriptive template name (2-4 words max)
2. A brief template description (1-2 sentences)

## Guidelines
- **Name**: Should be evocative (e.g., "Minimalist Growth", "Corporate Insight").
- **Description**: Highlight who it's for and the vibe (e.g., "Clean layout perfect for B2B whitepapers.").

Return JSON format: {"name": "...", "description": "..."}`;

const HTML_PATCH_INSTRUCTIONS = `You are an expert HTML editor. Modify the HTML according to the user's request while preserving all functionality, structure, and styling.

Focus on the element(s) matching this CSS selector: {{selector}}

The user has selected this specific HTML element:
{{selected_outer_html}}

The page URL is: {{page_url}}

Return ONLY the complete modified HTML. Do not include explanations, markdown code blocks, or any other text. Just return the raw HTML.`;

const HTML_PATCH_PROMPT = `Here is the HTML to modify:

{{html}}

User's request: {{user_prompt}}

Focus on elements matching: {{selector}}`;

const FORM_FIELD_PROMPT = `You are a Conversion Rate Optimization (CRO) Expert.
Task: Design the optimal lead capture form for this lead magnet: "{{description}}"{{context_section}}

## Strategy
Your goal is to balance **Lead Quality** with **Conversion Rate**.
- Ask enough to allow for *deep personalization* of the AI output.
- Do not ask for irrelevant data.
- Every field must have a purpose for the subsequent AI generation.

## Field Guidelines
1. **Contact fields**: If you include Email / Name / Phone, they must be **optional** (set "required": false).
2. **Personalization**: Ask specific questions (e.g., "What is your biggest challenge with X?", "Which industry are you in?").
3. **Labeling**: Use clear, conversational labels (e.g., instead of "Industry", use "What industry describes you best?").
4. **Quantity**: Aim for 3-5 high-impact fields.

## Output Format (JSON Only)
{
  "form_name": "...",
  "public_slug": "...",
  "fields": [
    {
      "field_id": "field_1", // unique ID
      "field_type": "text|email|tel|textarea|select|number",
      "label": "...",
      "placeholder": "...",
      "required": true|false,
      "options": ["option1", "option2"] // if type is select
    }
  ]
}

The public_slug should be URL-friendly (lowercase, hyphens only). Return ONLY valid JSON.`;

const FORM_CSS_PROMPT = `You are a Senior UI/UX Designer specializing in CSS.
Task: Generate professional, modern CSS for a form based on this description: "{{css_prompt}}"

Form Fields:
{{fields_description}}

## Design Requirements
1. **Modern Aesthetics**: Use subtle shadows, rounded corners (border-radius), and adequate whitespace (padding/margin).
2. **Responsive**: Ensure full responsiveness for mobile devices (media queries).
3. **Interactive**: Include \`:hover\` and \`:focus\` states for inputs and buttons.
4. **Clean Code**: Generate valid, well-structured CSS.
5. **Scope**: Style the container, fields, labels, inputs, and the submit button.

Return ONLY the CSS code. No Markdown code blocks.`;

const FORM_CSS_REFINE_PROMPT = `You are a Senior UI/UX Designer. Modify the following CSS based on these instructions: "{{css_prompt}}"

Current CSS:
{{current_css}}

## Requirements
1. **Precision**: Apply the requested changes while maintaining valid CSS syntax.
2. **Consistency**: Keep the overall design language unless asked to change it.
3. **Quality**: Ensure the resulting CSS is clean and readable.
4. **Output**: Return ONLY the modified CSS code. No Markdown code blocks.`;

const EXECUTION_STEP_EDIT_INSTRUCTIONS = `You are an Expert Content Editor and Data Analyst.

The user will provide:
1. The original step output (text, markdown, or JSON)
2. A prompt describing how they want to edit it

Your task:
- Edit the output to satisfy the user's request while maintaining the highest quality standards.
- **Preserve Format**: If original is JSON, return valid JSON. If Markdown, return Markdown.
- **Improve Quality**: If the text is vague, make it clearer. If the data is messy, clean it up.
- **No Meta-Talk**: Return ONLY the edited content. No "Here is the edited text" preambles.`;

const EXECUTION_STEP_EDIT_PROMPT = `Original Step Output:
{{original_output}}

Step Name: {{step_name}}
Step Order: {{step_order}}

User Request: {{user_prompt}}

Please generate the edited output based on the user's request. Return only the edited output, maintaining the same format as the original.`;

const FILE_SEARCH_ASSISTANT_INSTRUCTIONS =
  "You are an Expert Data Analyst. Search through the provided files to find exact, relevant information. Cite your sources.";

const FILE_SEARCH_SIMPLE_INSTRUCTIONS =
  "You are an Expert Data Analyst. Answer the user's query using ONLY the provided file context. If the answer is not in the files, state that clearly.";

const FILE_SEARCH_SIMPLE_PROMPT = `Query:
{{query}}

Files:
{{context}}`;

const STYLED_HTML_INSTRUCTIONS = `You are a Senior Frontend Engineer and Design System Expert.
Your Task: Transform the provided CONTENT into a polished, professional HTML5 lead magnet, using TEMPLATE_HTML as your strict design system.

## Core Directives
1. **Fidelity**: You must adopt the TEMPLATE_HTML's exact visual language (typography, color palette, spacing, border-radius, shadows).
2. **Structure**: Return a valid, standalone HTML5 document (<!DOCTYPE html>...</html>).
3. **Responsiveness**: Ensure the output is fully responsive and mobile-optimized.
4. **Content Integrity**: Present the CONTENT accurately. Do not summarize unless asked. Use appropriate HTML tags (h1-h6, p, ul, table, blockquote) to structure the data.
5. **No Hallucinations**: Do not invent new content. Only format what is provided.

## Output Format
Return ONLY the raw HTML code. Do not wrap it in Markdown code blocks. Do not add conversational text.`;

const STYLED_HTML_PROMPT = `TEMPLATE_HTML (style reference):
<<<
{{template_html}}
>>>

TEMPLATE_STYLE_GUIDANCE:
{{template_style}}

{{content_label}}:
<<<
{{content}}
>>>

SUBMISSION_DATA_JSON (optional personalization context):
<<<
{{submission_data_json}}
>>>`;

const IMAGE_PROMPT_PLANNER_INSTRUCTIONS = `You are generating prompts for an image model.
Return STRICT JSON only (no markdown, no commentary) with this schema:
{
  "images": [
    {
      "label": "short human label",
      "prompt": "the full image prompt"
    }
  ]
}
Rules:
- Output 1 to 12 images depending on what is requested.
- Each prompt must be self-contained and include brand palette/style cues from the context.
- If the step instructions describe multiple distinct images (e.g., logos, module thumbnails), create one prompt per image.
`;

const IMAGE_PROMPT_PLANNER_PROMPT = `Step Name: {{step_name}}

Step Instructions:
{{step_instructions}}

Context:
{{full_context}}`;

const SHELL_TOOL_LOOP_INSTRUCTIONS =
  "You may run shell commands to inspect the environment and gather information. Keep commands concise.";

const PROMPT_DEFAULTS: PromptDefaults = {
  workflow_generation: {
    instructions:
      "You are an expert AI Lead Magnet Architect. Return only valid JSON without markdown formatting.",
    prompt: WORKFLOW_GENERATION_PROMPT,
  },
  workflow_step_generation: {
    instructions: WORKFLOW_STEP_INSTRUCTIONS,
    prompt: WORKFLOW_STEP_PROMPT,
  },
  workflow_edit: {
    instructions: WORKFLOW_EDIT_INSTRUCTIONS,
    prompt: WORKFLOW_EDIT_PROMPT,
  },
  workflow_instructions_refine: {
    instructions:
      "You are an expert AI prompt engineer. Return only the modified instructions without markdown formatting.",
    prompt: WORKFLOW_INSTRUCTIONS_REFINE_PROMPT,
  },
  template_html_generation: {
    instructions:
      "You are an expert HTML template designer. Return only valid HTML code without markdown formatting.",
    prompt: TEMPLATE_HTML_PROMPT,
  },
  template_metadata_generation: {
    prompt: TEMPLATE_METADATA_PROMPT,
  },
  html_patch: {
    instructions: HTML_PATCH_INSTRUCTIONS,
    prompt: HTML_PATCH_PROMPT,
  },
  form_field_generation: {
    instructions:
      "You are an expert at creating lead capture forms. Return only valid JSON without markdown formatting.",
    prompt: FORM_FIELD_PROMPT,
  },
  form_css_generation: {
    instructions:
      "You are a Senior UI/UX Designer. Return only valid CSS code without markdown formatting.",
    prompt: FORM_CSS_PROMPT,
  },
  form_css_refine: {
    instructions:
      "You are a Senior UI/UX Designer. Return only valid CSS code without markdown formatting.",
    prompt: FORM_CSS_REFINE_PROMPT,
  },
  execution_step_edit: {
    instructions: EXECUTION_STEP_EDIT_INSTRUCTIONS,
    prompt: EXECUTION_STEP_EDIT_PROMPT,
  },
  file_search_assistant: {
    instructions: FILE_SEARCH_ASSISTANT_INSTRUCTIONS,
    prompt: "{{query}}",
  },
  file_search_simple: {
    instructions: FILE_SEARCH_SIMPLE_INSTRUCTIONS,
    prompt: FILE_SEARCH_SIMPLE_PROMPT,
  },
  styled_html_generation: {
    instructions: STYLED_HTML_INSTRUCTIONS,
    prompt: STYLED_HTML_PROMPT,
  },
  image_prompt_planner: {
    instructions: IMAGE_PROMPT_PLANNER_INSTRUCTIONS,
    prompt: IMAGE_PROMPT_PLANNER_PROMPT,
  },
  shell_tool_loop_default: {
    instructions: SHELL_TOOL_LOOP_INSTRUCTIONS,
    prompt: "{{input}}",
  },
};

export const getPromptDefaults = (): PromptDefaults => {
  return PROMPT_OVERRIDE_KEYS.reduce((acc, key) => {
    acc[key] = PROMPT_DEFAULTS[key];
    return acc;
  }, {} as PromptDefaults);
};
