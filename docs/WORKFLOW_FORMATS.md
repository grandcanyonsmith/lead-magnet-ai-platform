# Workflow Formats

This document explains the workflow format used by the Lead Magnet AI platform.

## Overview

The platform uses a **Steps Format** for all workflows. The legacy format has been removed and is no longer supported.

**All workflows must use the Steps Format.**

## Steps Format

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
      tools: ["web_search_preview"],
      tool_choice: "auto",
      depends_on: [] // No dependencies
    },
    {
      step_name: "Competitor Analysis",
      step_description: "Analyze competitors",
      step_order: 0, // Same order = can run in parallel
      model: "gpt-5",
      instructions: "Find and analyze competitors...",
      tools: ["web_search_preview"],
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
- `tools` (array, default: ["web_search_preview"]): Tools available to the AI
  - `"web_search_preview"`: Web search capability
  - `"computer_use"`: Computer use tool (for advanced workflows)
- `tool_choice` (string, default: "auto"): How the model should use tools
  - `"auto"`: Model decides when to use tools
  - `"required"`: Model must use tools
  - `"none"`: Model cannot use tools
- `depends_on` (array of numbers, optional): Step indices this step depends on

### Steps Format Features

- **Unlimited Steps**: Create workflows with any number of steps
- **Dependencies**: Steps can depend on other steps completing first
- **Parallel Execution**: Steps with the same `step_order` and no dependencies can run in parallel
- **Flexible Tools**: Each step can use different tools
- **Context Accumulation**: Each step receives context from all previous steps

### Steps Format Processing Flow

1. **Dependency Resolution**: System builds execution plan based on dependencies
2. **Parallel Execution**: Steps that can run in parallel are executed simultaneously
3. **Sequential Execution**: Steps with dependencies wait for prerequisites
4. **Context Building**: Each step receives accumulated context from previous steps
5. **HTML Generation** (if template is configured): Final step converts output to HTML

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

### Example 1: Simple Research + HTML (Steps Format)

```typescript
{
  workflow_name: "Market Analysis Report",
  steps: [
    {
      step_name: "Market Research",
      step_order: 0,
      instructions: "Research the target market size and trends",
      tools: ["web_search_preview"]
    },
    {
      step_name: "Competitor Analysis",
      step_order: 0, // Parallel with Market Research
      instructions: "Identify and analyze top competitors",
      tools: ["web_search_preview"]
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

## See Also

- [Architecture Overview](./ARCHITECTURE.md)
- [Execution Paths](./EXECUTION_PATHS.md)
- [Glossary](./GLOSSARY.md)

