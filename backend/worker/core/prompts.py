"""
Central configuration for all AI system prompts (Worker side).

These prompts serve as the defaults for the application.
Many of these can be overridden per-tenant via the `prompt_overrides` setting.
"""

# Default Model Configuration
PROMPT_CONFIGS = {
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
