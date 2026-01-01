# Workflows Context Pack

This pack is for changes that impact the workflow authoring experience end-to-end (API, worker behaviour, frontend editors, and validation).

## Domain Overview

| Layer | Critical Files |
| --- | --- |
| Backend | `backend/api/src/domains/workflows/*` (controllers, services, routes, job handlers) |
| Frontend | `frontend/src/app/dashboard/workflows/*`, `frontend/src/hooks/api/useWorkflows.ts`, `frontend/src/lib/api/workflows.client.ts` |
| Worker | `backend/worker/services/workflow_orchestrator.py`, `backend/worker/services/ai_step_processor.py` |
| Docs | `docs/contracts/README.md` (REST contract), `docs/testing/TEST_WORKFLOW_GENERATION_E2E.md` (end-to-end validation) |

## Typical Tasks

1. **Add or tweak a workflow endpoint**
   - Update the relevant controller/service under `src/domains/workflows`.
   - Register or modify the route in `src/domains/workflows/routes/workflowRoutes.ts`.
   - Extend the typed contract (`frontend/src/lib/api/contracts.ts`) and the `WorkflowsClient`.
   - Wire the UI via the workflow hooks or React query endpoints.

2. **Adjust workflow generation logic**
   - API layer: `workflowGenerationJobService.ts` and `workflowGenerationService.ts`.
   - Worker layer: `workflow_orchestrator.py` plus any new service modules.
   - Update docs/tests: `docs/testing/TEST_WORKFLOW_GENERATION_E2E.md`.

3. **Update validation/config parsing**
   - Use helpers in `services/workflow/workflowConfigSupport.ts`.
   - Update validators or step normalization logic under `workflowValidationController.ts`.
   - Mirror shape changes in `frontend/src/types/workflow.ts`.

## Commands & Checks

```bash
# Backend API
cd backend/api
npm run build   # or npm run dev for watch mode

# Worker (if job semantics change)
cd backend/worker
pytest

# Frontend sanity checks
cd frontend
npm run lint
npx playwright test --grep workflows
```

## Testing Matrix

- **Automated**: run `node scripts/test-workflow-generation-e2e.js` (or the `.sh` variant) to ensure webhook-driven generation still works.
- **Manual UI**: follow `docs/testing/TESTING_GUIDE.md` (workflow section) plus `docs/testing/WORKFLOW_EDIT_MOBILE_TEST.md` if you touched responsive layouts.
- **Step reruns**: `docs/testing/TEST_STEP_RERUN.md` + `python3 scripts/testing/test-step-rerun.py <job_id> <step_index>`.

## Gotchas

- Keep path aliases in mind when touching imports: use `@domains/workflows/...` inside the API to avoid brittle relative paths.
- Workflow JSON schemas are shared with the frontend through `@/types`. Always update those types when the backend shape changes to prevent runtime errors.
- Public forms auto-create forms whenever a workflow is created; make sure `formService` changes align with workflow defaults.
