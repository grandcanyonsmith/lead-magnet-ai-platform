import { formatAllModelDescriptionsMarkdown } from './modelDescriptions';

export interface WorkflowPromptContext {
  description: string;
  brandContext?: string;
  icpContext?: string;
}

export function buildWorkflowPrompt(context: WorkflowPromptContext): string {
  const { description, brandContext, icpContext } = context;

  let contextSection = '';
  if (brandContext) {
    contextSection += `\n\n## Brand Context\n${brandContext}`;
  }
  if (icpContext) {
    contextSection += `\n\n## Ideal Customer Profile (ICP) Document\n${icpContext}`;
  }

  return `You are an expert at creating AI-powered lead magnets. Based on this description: "${description}", generate a complete lead magnet configuration with workflow steps.${contextSection}

## What to Generate

1. Lead Magnet Name: Short, catchy, 2-4 words that clearly communicate value
2. Lead Magnet Description: 1-2 sentences explaining what it does and why it's valuable
3. Workflow Steps: Array of steps, each with appropriate tools, model, and detailed instructions

## Available OpenAI Tools

### web_search
- **Use when**: Step needs current information from the web, research, or real-time data
- **Examples**: Market research, competitor analysis, current trends, news, statistics
- **Tool choice**: "auto" (let model decide when to search)

### image_generation
- **Use when**: Step needs to create visual content (diagrams, illustrations, graphics)
- **Examples**: Creating infographics, visual summaries, custom images
- **Tool choice**: "auto" or "required" if images are essential
- **Note**: Generated images will be available to subsequent steps

### code_interpreter
- **Use when**: Step needs to execute Python code for calculations, data processing, or analysis
- **Examples**: Data analysis, calculations, generating charts/graphs, processing data
- **Tool choice**: "auto" or "required" if code execution is essential
- **Note**: Requires container configuration (auto-added by system)

### file_search
- **Use when**: Step needs to search through uploaded files or documents
- **Examples**: Analyzing uploaded PDFs, searching documents, extracting information from files
- **Tool choice**: "auto"
- **Note**: Requires vector_store_ids configuration (not commonly used)

### computer_use_preview
- **Use when**: Step needs to control computer interfaces (rarely needed for lead magnets)
- **Examples**: Interacting with web applications, taking screenshots, browser automation
- **Tool choice**: "auto" or "required"
- **Note**: Requires container configuration and is rarely needed for lead magnets

## Tool Choice Options

- **"auto"**: Model decides when to use tools (RECOMMENDED for most steps)
  - Use for: Research steps, content generation with optional tools, most common cases
- **"required"**: Model must use at least one tool (use sparingly)
  - Use for: Steps where tools are absolutely essential (e.g., must search web, must generate image)
  - Warning: Only use when tools are guaranteed to be available
- **"none"**: Disable tools entirely
  - Use for: HTML generation, final formatting, pure content transformation steps

## Available Models

${formatAllModelDescriptionsMarkdown()}

## Writing Effective Step Instructions

### Good Instruction Examples:

**Example 1 - Research Step:**
\`\`\`
Generate a comprehensive market research report for [company_name] in the [industry] industry. Research current market trends, competitor landscape, and growth opportunities. Include specific statistics, recent developments, and actionable insights. Personalize all recommendations based on [company_name]'s size ([company_size]) and target market ([target_market]).
\`\`\`

**Example 2 - Analysis Step:**
\`\`\`
Analyze the research findings from Step 1 and create a personalized SWOT analysis for [company_name]. Focus on opportunities and threats specific to the [industry] industry. Include actionable recommendations based on [company_name]'s current situation ([current_challenges]).
\`\`\`

**Example 3 - Content Generation Step:**
\`\`\`
Create a personalized action plan document for [name] at [company_name]. Use insights from previous steps to create 5-7 specific, actionable recommendations. Format as a clear, professional document with sections for each recommendation. Include timelines and expected outcomes where relevant.
\`\`\`

### Bad Instruction Examples (Avoid These):

❌ "Generate a report" (too vague, no guidance)
❌ "Do research" (not specific about what to research)
❌ "Create content" (no structure or requirements)
❌ "Make it good" (subjective, not actionable)

### Instruction Best Practices:

1. **Be Specific**: Clearly state what the step should produce
2. **Reference Form Fields**: Use [field_name] syntax to reference form submission data
3. **Reference Previous Steps**: Mention how to use outputs from earlier steps
4. **Define Output Format**: Specify structure, sections, or format expectations
5. **Set Quality Standards**: Include expectations for depth, detail, or comprehensiveness
6. **Personalize**: Always include guidance on personalizing content from form data

## Step Ordering and Dependencies

- **Step 0**: Usually research or data gathering (uses form submission data)
- **Step 1+**: Build upon previous steps, transform or enhance content
- **Final Step**: Often HTML generation (tool_choice: "none", tools: [])

IMPORTANT: Do NOT automatically add web_search or web_search_preview tools to steps using o4-mini-deep-research model unless the user explicitly requests web search capabilities. The o4-mini-deep-research model does not require web_search tools to function effectively.

**Dependencies (depends_on field) - REQUIRED:**
- **YOU MUST include depends_on for EVERY step** - it is a required field
- depends_on is an array of step indices (0-based) that this step depends on
- **Rules for setting depends_on:**
  - Steps with step_order: 0 should have depends_on: [] (no dependencies, can run first)
  - Steps with the same step_order should have depends_on: [] (can run in parallel)
  - Steps with higher step_order MUST depend on all steps with lower step_order
  - **Example**: If Step 2 has step_order: 1 and Step 0 and Step 1 both have step_order: 0, then Step 2 should have depends_on: [0, 1]
- **Parallel execution**: Steps with same step_order and depends_on: [] can run simultaneously
- **Sequential execution**: Steps with higher step_order must wait for all lower step_order steps to complete

Common patterns:
- Research → Analysis → Content Generation → HTML Formatting
- Data Collection → Processing → Visualization → Final Document
- Research → Personalization → Formatting
- Parallel research: Multiple research steps with step_order: 0 and depends_on: [] can run in parallel

## Output Format Expectations

### Research Steps:
- Output: Markdown report with headings, sections, data, insights
- Format: Structured markdown with clear organization

### Analysis Steps:
- Output: Analysis, summaries, or transformations of previous step content
- Format: Markdown with logical sections

### Content Generation Steps:
- Output: New content based on previous steps and form data
- Format: Markdown or structured content

### HTML Generation Steps:
- Output: Complete HTML document matching template
- Format: Valid HTML5 (no markdown)

## Example Workflow Structure

\`\`\`json
{
  "workflow_name": "Personalized Market Analysis",
  "workflow_description": "Generates a comprehensive market analysis report personalized to the user's company and industry.",
  "steps": [
    {
      "step_name": "Deep Research",
      "step_description": "Conduct comprehensive market research",
      "model": "gpt-5",
      "instructions": "Generate a comprehensive market research report for [company_name] in the [industry] industry. Research current market trends, competitor landscape, and growth opportunities. Include specific statistics, recent developments, and actionable insights. Personalize all recommendations based on [company_name]'s size and target market.",
      "step_order": 0,
      "depends_on": [],
      "tools": [],
      "tool_choice": "none"
    },
    {
      "step_name": "Competitor Analysis",
      "step_description": "Analyze competitors in parallel with market research",
      "model": "gpt-4o",
      "instructions": "Research and analyze top 5 competitors for [company_name] in the [industry] industry. Include their strengths, weaknesses, and market positioning.",
      "step_order": 0,
      "depends_on": [],
      "tools": [],
      "tool_choice": "none"
    },
    {
      "step_name": "SWOT Analysis",
      "step_description": "Create SWOT analysis based on research findings",
      "model": "gpt-5",
      "instructions": "Using insights from Step 1 (Deep Research) and Step 2 (Competitor Analysis), create a comprehensive SWOT analysis for [company_name]. Focus on opportunities and threats specific to the [industry] industry.",
      "step_order": 1,
      "depends_on": [0, 1],
      "tools": [],
      "tool_choice": "none"
    },
    {
      "step_name": "HTML Formatting",
      "step_description": "Format research content into styled HTML matching template",
      "model": "gpt-5",
      "instructions": "Transform the research content from previous steps into a beautifully formatted HTML document that matches the provided template. Preserve all research findings, statistics, and insights. Ensure the HTML is accessible, mobile-responsive, and maintains the template's design structure.",
      "step_order": 2,
      "depends_on": [2],
      "tools": [],
      "tool_choice": "none"
    }
  ]
}
\`\`\`

## Return Format

Return ONLY valid JSON matching this structure:
\`\`\`json
{
  "workflow_name": "...",
  "workflow_description": "...",
  "steps": [
    {
      "step_name": "...",
      "step_description": "...",
      "model": "...",
      "instructions": "Detailed, specific instructions with [field_name] references",
      "step_order": 0,
      "depends_on": [],  // REQUIRED: Array of step indices (0-based) this step depends on. Steps with step_order: 0 should have []. Steps with higher step_order must include all lower step_order indices.
      "tools": ["..."],
      "tool_choice": "auto|required|none"
    }
  ]
}
\`\`\`

Important: Return ONLY the JSON, no markdown formatting, no explanations.`;
}

export const workflowPromptService = {
  buildWorkflowPrompt,
};

export type WorkflowPromptService = typeof workflowPromptService;
