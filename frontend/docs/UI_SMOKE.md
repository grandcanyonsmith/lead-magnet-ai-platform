# UI Smoke Test (Playwright)

Quick high-level check of the redesigned UI and modal flows.

## Prereqs
- Backend + frontend running locally (e.g., API at `http://localhost:3001`, app at `http://localhost:3000`)
- Test user credentials with dashboard access
- Node deps installed in `frontend/`

## Env vars
```
export BASE_URL=http://localhost:3000
export E2E_EMAIL=you@example.com
export E2E_PASSWORD=your_password
```

## Run
```bash
cd frontend
npx playwright test tests/ui-smoke.spec.ts
```

## What it checks
- Login works
- Workflows, jobs, settings, and files pages render
- Files delete flow shows the custom ConfirmDialog (if files exist)
- Workflow delete flow shows the custom ConfirmDialog (if workflows exist)

## Notes
- Tests are non-destructive: dialogs are opened and cancelled when present.
- If no files/workflows exist, those dialog checks are skipped.
