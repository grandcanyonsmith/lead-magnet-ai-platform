# Frontend Refactor Candidates

## Priority ranking (impact vs risk)

Legend: Impact (Low/Medium/High), Risk (Low/Medium/High).

1) StepHeader (`frontend/src/components/jobs/StepHeader.tsx`)
Impact: High. Risk: Medium.
Rationale: Very large component; mixes parsing helpers, UI state, and rendering for meta/context/actions.
Extraction boundaries:
- Move parsing + mapping helpers (`getRecord`, `getString`, `extractServiceTier`, `extractReasoningEffort`) and constants (`SERVICE_TIER_*`, `REASONING_*`) into a shared helper (e.g. `frontend/src/utils/stepMeta.ts`).
- Extract UI subcomponents: `StepTimingRow`, `StepMetaRow`, `StepActionsMenu`, `DependencyPreviewGrid`.

2) PromptOverridesSettings (`frontend/src/components/settings/PromptOverridesSettings.tsx`)
Impact: High. Risk: Medium.
Rationale: Large component handling JSON parsing, draft state, API defaults, and heavy rendering.
Extraction boundaries:
- Move JSON helpers (`parsePromptOverrides`, `orderOverrides`, `buildOverridePayload`, `getOverrideStatus`) to `frontend/src/utils/promptOverrides.ts`.
- Extract per-prompt UI into `PromptOverrideCard` plus smaller subcomponents for header/status/actions.

3) Workflow defaults duplication (`frontend/src/hooks/useWorkflowEdit.ts`, `frontend/src/hooks/useWorkflowSteps.ts`)
Impact: Medium. Risk: Low.
Rationale: Duplicate default-resolution logic risks drift and makes updates harder.
Extraction boundaries:
- Centralize `DEFAULT_TOOL_CHOICE`, `resolveToolChoice`, `resolveServiceTier`, `resolveTextVerbosity`, `buildDefaultSteps` in `frontend/src/utils/workflowDefaults.ts`.

4) Markdown rendering duplication (multiple components)
Impact: Medium. Risk: Medium.
Rationale: Repeated dynamic loading and remark-gfm usage across components.
Extraction boundaries:
- Shared `MarkdownRenderer` component + `useRemarkGfm` hook under `frontend/src/components/ui/MarkdownRenderer.tsx` or `frontend/src/hooks/useRemarkGfm.ts`.

5) Settings defaults duplication (`frontend/src/components/settings/SettingsEditorContext.tsx`, `frontend/src/components/settings/GeneralSettings.tsx`)
Impact: Medium. Risk: Low.
Rationale: Default values and fallbacks are repeated in multiple places.
Extraction boundaries:
- Centralize defaults in `frontend/src/constants/settingsDefaults.ts` and consume from both files.

6) PreviewRenderer (`frontend/src/components/artifacts/PreviewRenderer.tsx`)
Impact: High. Risk: High.
Rationale: Very large, multi-mode renderer; high blast radius across artifact preview types.
Extraction boundaries:
- Move content-type detection and parsing helpers into `frontend/src/components/artifacts/previewUtils.ts`.
- Split per-format renderers (Markdown, HTML, JSON, Image, Logs, Fallback) into dedicated components.

## Shared utilities proposals

### Markdown rendering
Target: unify markdown rendering and remark-gfm lazy loading.
Suggested modules:
- `frontend/src/components/ui/MarkdownRenderer.tsx` (component wrapper)
- `frontend/src/hooks/useRemarkGfm.ts` (lazy-load remark-gfm)

Suggested API:
- `MarkdownRenderer` props: `value: string`, `className?: string`, `components?: Record<string, React.ComponentType<any>>`, `fallbackClassName?: string`.
- `useRemarkGfm` returns `remarkGfmPlugin | null` and handles cleanup.

Primary consumers:
- `frontend/src/components/jobs/StepContent.tsx`
- `frontend/src/components/ui/JsonViewer.tsx`
- `frontend/src/components/settings/PromptOverridesSettings.tsx`
- `frontend/src/components/artifacts/PreviewRenderer.tsx`
- `frontend/src/app/dashboard/playground/components/LogViewer.tsx`
- `frontend/src/components/jobs/StepHeader.tsx`

### Defaults consolidation
Target: prevent drift in workflow + settings defaults.
Suggested modules:
- `frontend/src/utils/workflowDefaults.ts`
- `frontend/src/constants/settingsDefaults.ts`

Suggested exports:
- `workflowDefaults`: `DEFAULT_TOOL_CHOICE`, `resolveToolChoice`, `resolveServiceTier`, `resolveTextVerbosity`, `buildDefaultSteps`.
- `settingsDefaults`: `DEFAULT_AI_MODEL`, `DEFAULT_TOOL_CHOICE`, `DEFAULT_SERVICE_TIER`, `DEFAULT_TEXT_VERBOSITY`, `DEFAULT_WORKFLOW_IMPROVEMENT_SERVICE_TIER`, `DEFAULT_WORKFLOW_IMPROVEMENT_REASONING_EFFORT`.

## Scoped refactor steps (top 2 files)

### StepHeader (`frontend/src/components/jobs/StepHeader.tsx`)
1) Extract helpers and constants into `frontend/src/utils/stepMeta.ts`.
2) Split UI into focused components (e.g., `StepTimingRow`, `StepMetaRow`, `StepActionsMenu`, `DependencyPreviewGrid`) in `frontend/src/components/jobs/`.
3) Keep `StepHeader` as composition only; preserve props and classNames to avoid UI changes.
4) Verify job detail views: step header, context toggle, rerun/edit actions, dependency previews.

### PromptOverridesSettings (`frontend/src/components/settings/PromptOverridesSettings.tsx`)
1) Move JSON helper functions to `frontend/src/utils/promptOverrides.ts`.
2) Extract per-key card into `PromptOverrideCard` (props: definition, defaults, override, edit state, handlers).
3) Extract the JSON editor card into `PromptOverridesJsonEditor` for clarity and reuse.
4) Keep state management in the top-level component; pass only needed props to subcomponents.
5) Verify settings page: prompt override status badges, edit flow, defaults preview, JSON validation errors.
