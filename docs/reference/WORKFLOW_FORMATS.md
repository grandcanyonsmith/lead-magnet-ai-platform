# Workflow Formats

This document explains the workflow format used by the Lead Magnet AI platform.

## Overview

The platform uses a **Steps Format** for all workflows. The legacy format has been removed and is no longer supported.

**All workflows must use the Steps Format.**

## Legacy Format (Historical)

> **Status**: Removed - No longer supported  
> **Note**: This section is kept for historical reference only. All workflows have been migrated to Steps Format.

The legacy format (removed) used boolean flags to control workflow behavior:

```typescript
{
  workflow_name: "My Lead Magnet",
  research_enabled: true,
  html_enabled: true,
  ai_instructions: "Generate a comprehensive report about...",
  ai_model: "gpt-5",
  rewrite_model: "gpt-5",
  template_id: "template_123",
  template_version: 0
}
```

### Legacy Format Fields

- `research_enabled` (boolean): If `true`, generates an AI research report first
- `html_enabled` (boolean): If `true`, converts the research report into HTML using a template
- `ai_instructions` (string): Instructions for the research step
- `ai_model` (string): Model to use for research (default: "gpt-5")
- `rewrite_model` (string): Model to use for HTML generation (default: "gpt-5")
- `template_id` (string): Template ID for HTML generation (required if `html_enabled` is true)

### Legacy Format Processing Flow

1. **Research Step** (if `research_enabled` is true):
   - Uses `ai_instructions` and form submission data
   - Generates a research report
   - Stores report as artifact

2. **HTML Generation Step** (if `html_enabled` is true):
   - Uses research report (if available) or form submission data
   - Applies HTML template
   - Generates final HTML deliverable

### Limitations

- Only supports 2 steps maximum (research + HTML)
- No support for custom step dependencies
- No support for parallel execution
- Limited flexibility for complex workflows

## New Steps Format

The new steps format provides full flexibility for multi-step workflows:

```typescript
{
  workflow_name: "My Lead Magnet",
  steps: [
    {
      step_name: "Market Research",
      step_description: "Research the target market",
      step_order: 0,
      model: "gpt-5",
      instructions: "Analyze the market for...",
      tools: ["web_search"],
      tool_choice: "auto",
      depends_on: [] // No dependencies
    },
    {
      step_name: "Competitor Analysis",
      step_description: "Analyze competitors",
      step_order: 0, // Same order = can run in parallel
      model: "gpt-5",
      instructions: "Find and analyze competitors...",
      tools: ["web_search"],
      tool_choice: "auto",
      depends_on: [] // No dependencies
    },
    {
      step_name: "HTML Generation",
      step_description: "Generate final HTML",
      step_order: 1,
      model: "gpt-5",
      instructions: "Create HTML using template...",
      tools: [],
      tool_choice: "none",
      depends_on: [0, 1] // Depends on both previous steps
    }
  ],
  template_id: "template_123",
  template_version: 0
}
```

### Steps Format Fields

Each step can have:

- `step_name` (string, required): Human-readable name for the step
- `step_description` (string, optional): Description of what the step does
- `step_order` (number, required): Execution order (steps with same order can run in parallel)
- `model` (string, default: "gpt-5"): AI model to use
- `instructions` (string, required): Instructions for the AI
- `is_deliverable` (boolean, optional): If true, use this step's output as the final deliverable source
- `tools` (array, default: ["web_search"]): Tools available to the AI
  - `"web_search"`: Web search capability
  - `"computer_use"`: Computer use tool (for advanced workflows)
- `tool_choice` (string, default: "auto"): How the model should use tools
  - `"auto"`: Model decides when to use tools
  - `"required"`: Model must use tools
  - `"none"`: Model cannot use tools
- `depends_on` (array of numbers, optional): Step indices (0-based) this step depends on
  - If omitted, the system falls back to `step_order` to infer dependencies (legacy behavior)
- `is_deliverable` (boolean, optional): Marks this step as the deliverable source
  - If none are set, terminal steps (highest `step_order`) are used

### Steps Format Features

- **Unlimited Steps**: Create workflows with any number of steps
- **Dependencies**: Steps can depend on other steps completing first
- **Parallel Execution**: Steps with the same `step_order` and no dependencies can run in parallel
- **Flexible Tools**: Each step can use different tools
- **Context Accumulation**: Each step receives context from its dependency steps

### Steps Format Processing Flow

1. **Dependency Resolution**: System builds execution plan based on dependencies
2. **Parallel Execution**: Steps that can run in parallel are executed simultaneously
3. **Sequential Execution**: Steps with dependencies wait for prerequisites
4. **Context Building**: Each step receives accumulated context from its dependencies
5. **HTML Generation** (if template is configured): Deliverable steps (`is_deliverable`) are used as the deliverable source; if none are marked, terminal step outputs (highest `step_order`) are used and rendered into template-styled HTML (opt-in forms are stripped)

## Historical: Legacy Format Migration

> **Note**: All workflows have been migrated to Steps Format. This section is kept for historical reference.

### Migration (Completed)

All legacy workflows were automatically migrated to steps format. The migration process converted:

You can manually migrate a legacy workflow:

```typescript
// Legacy format
{
  research_enabled: true,
  html_enabled: true,
  ai_instructions: "Generate report about X",
  ai_model: "gpt-5",
  rewrite_model: "gpt-5"
}

// Migrated to steps format
{
  steps: [
    {
      step_name: "Deep Research",
      step_description: "Generate comprehensive research report",
      step_order: 0,
      model: "gpt-5",
      instructions: "Generate report about X",
      tools: ["web_search"],
      tool_choice: "auto"
    },
    {
      step_name: "HTML Rewrite",
      step_description: "Rewrite content into styled HTML matching template",
      step_order: 1,
      model: "gpt-5",
      instructions: "Rewrite the research content into styled HTML...",
      tools: [],
      tool_choice: "none"
    }
  ]
}
```

## Current Status

- ✅ **All workflows use Steps Format**
- ✅ **Legacy format has been removed**
- ✅ **LegacyWorkflowProcessor has been removed**
- ✅ **All workflows have been migrated**

## Recommendations

**Steps Format is required for ALL workflows:**
- All new workflows must use Steps Format
- Simple workflows with just research + HTML
- Complex workflows with multiple research steps
- Workflows requiring parallel execution
- Workflows with custom dependencies
- Any workflow that needs flexibility or future extensibility

## Examples

### Example 1: Simple Research + HTML (Legacy)

```typescript
{
  workflow_name: "Hospital Checklist",
  research_enabled: true,
  html_enabled: true,
  ai_instructions: "Create a comprehensive hospital checklist for pregnant women",
  template_id: "checklist_template_123"
}
```

### Example 2: Multi-Step Research (Steps Format)

```typescript
{
  workflow_name: "Market Analysis Report",
  steps: [
    {
      step_name: "Market Research",
      step_order: 0,
      instructions: "Research the target market size and trends",
      tools: ["web_search"]
    },
    {
      step_name: "Competitor Analysis",
      step_order: 0, // Parallel with Market Research
      instructions: "Identify and analyze top competitors",
      tools: ["web_search"]
    },
    {
      step_name: "Synthesis",
      step_order: 1,
      instructions: "Combine market research and competitor analysis into comprehensive report",
      depends_on: [0, 1],
      tools: []
    },
    {
      step_name: "HTML Generation",
      step_order: 2,
      instructions: "Convert report to HTML",
      depends_on: [2],
      tools: []
    }
  ],
  template_id: "report_template_123"
}
```

## Handoff Payload Modes

For `workflow_handoff` steps, `handoff_payload_mode` controls the primary payload value:

- `previous_step_output`: Use the most recent step output (default)
- `full_context`: Use the full dependency context for the step
- `submission_only`: Do not include step output as the primary value
- `deliverable_output`: Use deliverable-only context from `is_deliverable` (or terminal steps)

## See Also

- [Architecture Overview](./ARCHITECTURE.md)
- [Execution Paths](./EXECUTION_PATHS.md)
- [Glossary](./GLOSSARY.md)

