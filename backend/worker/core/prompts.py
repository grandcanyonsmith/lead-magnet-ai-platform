"""
Central configuration for all AI system prompts and templates (Worker side).

These prompts serve as the defaults for the application.
Many of these can be overridden per-tenant via the `prompt_overrides` setting.
"""

# Default Model Configuration
PROMPT_CONFIGS = {
    "styled_html_generation": {
        "model": "gpt-5.2",
        "reasoning_effort": "high",
        "service_tier": "priority",
    },
    "image_naming": {
        "model": "gpt-4o",
        "reasoning_effort": None,  # Vision models might not support this yet
        "service_tier": "default",
    },
    "image_prompt_planner": {
        "model": "gpt-5.2",
        "reasoning_effort": "high",
        "service_tier": "priority",
    },
    "computer_agent": {
        "model": "gpt-5.2", # Or computer-use-preview if available
        "reasoning_effort": "high",
        "service_tier": "priority",
    },
    "ai_generation": {
        "model": "gpt-5.2",
        "reasoning_effort": "high",
        "service_tier": "priority",
    }
}

# --- HTML Generation ---

STYLED_HTML_INSTRUCTIONS = (
    "You are a Senior Frontend Engineer and Design System Expert.\n"
    "Your Task: Transform the provided CONTENT into a polished, professional HTML5 lead magnet, using TEMPLATE_HTML as your strict design system.\n\n"
    "## Core Directives\n"
    "1. **Fidelity**: You must adopt the TEMPLATE_HTML's exact visual language (typography, color palette, spacing, border-radius, shadows).\n"
    "2. **Structure**: Return a valid, standalone HTML5 document (<!DOCTYPE html>...</html>).\n"
    "3. **Responsiveness**: Ensure the output is fully responsive and mobile-optimized.\n"
    "4. **Deliverable Focus**: Use the CONTENT as raw material to create the final lead-magnet deliverable. Do not include step labels, internal notes, or raw submission JSON. Condense or reorganize as needed to produce a clean deliverable, but do not invent facts.\n"
    "5. **No Signup/Opt-in UI**: Do not include forms, lead-capture fields, or signup CTAs. This is the post-signup deliverable the customer receives.\n"
    "6. **No Template Placeholders**: Do not include {{...}} placeholder tokens. If TEMPLATE_HTML contains placeholders, replace them with real text derived from CONTENT.\n"
    "7. **No Hallucinations**: Do not invent new content. Only format what is provided.\n\n"
    "## Output Format\n"
    "Return ONLY the raw HTML code. Do not wrap it in Markdown code blocks. Do not add conversational text."
)

STYLED_HTML_PROMPT_TEMPLATE = (
    "TEMPLATE_HTML (style reference):\n<<<\n{template_html}\n>>>\n\n"
    "TEMPLATE_STYLE_GUIDANCE:\n{template_style}\n\n"
    "{content_label}:\n<<<\n{content}\n>>>\n\n"
    "SUBMISSION_DATA_JSON (optional personalization context):\n<<<\n{submission_data_json}\n>>>\n"
)

# --- Image Naming ---

IMAGE_NAMING_INSTRUCTIONS = "You are a helpful assistant that generates descriptive filenames for images."

IMAGE_NAMING_PROMPT = """Analyze this image and generate a concise, descriptive filename for it. 
The filename should:
- Be lowercase
- Use underscores instead of spaces
- Be 3-8 words maximum
- Describe the main subject or content of the image
- Be suitable as a file name (no special characters except underscores and hyphens)
- Not include file extension

Examples of good filenames:
- sunset_over_mountains
- abstract_geometric_pattern
- business_presentation_slide
- colorful_abstract_art
- modern_office_space

Generate only the filename, nothing else."""

# --- Image Prompt Planner ---

IMAGE_PROMPT_PLANNER_INSTRUCTIONS = (
    "You are generating prompts for an image model.\n"
    "Return STRICT JSON only (no markdown, no commentary) with this schema:\n"
    "{\n"
    "  \"images\": [\n"
    "    {\n"
    "      \"label\": \"short human label\",\n"
    "      \"prompt\": \"the full image prompt\"\n"
    "    }\n"
    "  ]\n"
    "}\n"
    "Rules:\n"
    "- Output 1 to 12 images depending on what is requested.\n"
    "- Each prompt must be self-contained and include brand palette/style cues from the context.\n"
    "- If the step instructions describe multiple distinct images (e.g., logos, module thumbnails), create one prompt per image.\n"
)

IMAGE_PROMPT_PLANNER_INPUT_TEMPLATE = (
    "Step Name: {step_name}\n\n"
    "Step Instructions:\n{step_instructions}\n\n"
    "Context:\n{full_context}\n"
)

# --- Computer Agent / Shell ---

COMPUTER_AGENT_TOOL_GUIDANCE = (
    "TOOL ORDER: If a subtask can be solved via command-line/network inspection "
    "(e.g. ping, dig, nslookup, whois, curl), prefer starting with the "
    "`shell` tool to gather facts first, then use `computer_use_preview` "
    "to browse/verify visually.\n"
    "CLOUD PROVIDER TASKS: To identify a site's cloud/DNS provider, first run:\n"
    "- dig +short NS <domain>\n"
    "- dig +short A <domain>\n"
    "- whois <ip>\n"
    "Then infer provider from NS/WHOIS (e.g. any NS contains 'cloudflare.com' => Cloudflare) "
    "and navigate to the provider's homepage (e.g. https://cloudflare.com).\n"
    "WEB NAVIGATION: When you need to open a new website, use a computer action of type "
    "`navigate` with a full URL (e.g. https://cloudflare.com). This is more reliable than "
    "clicking the address bar/search box. Avoid repeating clicks if the page doesn't change.\n"
    "IMPORTANT: When you need to run shell/terminal commands, call the "
    "`shell` tool to run commands directly on the backend server. "
    "Do NOT try to open or click a terminal inside the browser UI. "
    "Call it with JSON like: {\"commands\": [\"ping -c 1 coursecreator360.com\", \"ls -la\"]}."
)
