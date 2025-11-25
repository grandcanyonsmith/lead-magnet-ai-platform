# Legacy Workflow Flags Documentation (Historical)

> **Status**: Legacy format has been removed. This document is kept for historical reference only.

## Overview

This document describes the historical behavior of legacy workflow flags: `research_enabled`, `html_enabled`, and `rewrite_enabled`. These flags and the legacy format have been removed from the system.

## Historical State

### research_enabled and html_enabled

**Status**: Removed - No longer supported

**Historical Behavior** (before removal):
- These flags were ONLY functional for workflows that did NOT have a `steps` array (legacy workflows)
- When a workflow had a non-empty `steps` array, these flags were completely ignored during processing
- Used by `LegacyWorkflowProcessor` in `backend/worker/legacy_processor.py` (removed)
- API automatically migrated legacy workflows to steps format on creation

**Historical Processing Logic** (before removal):
- If workflow had `steps` array → Used Steps Format (processed by `WorkflowOrchestrator`)
- If workflow had NO `steps` array → Used Legacy Format (processed by `LegacyWorkflowProcessor` - removed)

**Legacy Format Processing**:
1. **Research Step** (if `research_enabled` is true):
   - Uses `ai_instructions` and form submission data
   - Generates a research report using `web_search` tool
   - Stores report as artifact

2. **HTML Generation Step** (if `html_enabled` is true):
   - Uses research report (if available) or form submission data
   - Applies HTML template
   - Generates final HTML deliverable

**Limitations**:
- Only supports 2 steps maximum (research + HTML)
- No support for custom step dependencies
- No support for parallel execution
- Limited flexibility for complex workflows

### rewrite_enabled

**Status**: Removed - Was never used in processing code

**Removed State**:
- Removed from type definitions
- Removed from validation schemas
- Removed from frontend UI
- Removed from documentation
- Was never used in processing code

## Migration (Completed)

### Migration Status

✅ **All legacy workflows have been migrated to Steps Format**
✅ **LegacyWorkflowProcessor has been removed**
✅ **Legacy format support has been removed**

### Historical Migration Process

Legacy workflows (those without `steps` array) were migrated to the new steps format:

1. **Research Step Migration**:
   - If `research_enabled` is true and `ai_instructions` exists:
     - Create a step with `step_name: "Deep Research"`
     - Set `tools: ["web_search"]`
     - Set `tool_choice: "auto"`
     - Use `ai_instructions` as the step's `instructions`

2. **HTML Generation Step Migration**:
   - If `html_enabled` is true:
     - Create a step with `step_name: "HTML Rewrite"`
     - Set `tools: []`
     - Set `tool_choice: "none"`
     - Set appropriate instructions for HTML generation

The API automatically performs this migration when creating new workflows, but existing workflows in the database may still use the legacy format.

## Removal Timeline

- ✅ **Completed**: All workflows migrated to Steps Format
- ✅ **Completed**: LegacyWorkflowProcessor removed
- ✅ **Completed**: Legacy format support removed from API
- ✅ **Completed**: Legacy format validation removed

## Current Status

- All workflows use Steps Format
- Legacy format is no longer supported
- Creating workflows without steps will result in an error
- Legacy fields in database records are ignored

## References

- See `docs/WORKFLOW_FORMATS.md` for current format specifications
- Migration utilities are deprecated (kept for reference only)

