# Backend API Context Pack

Use this when you are touching the TypeScript/Fastify Lambda API that lives under `backend/api`.

## Purpose & Highlights

- Multi-tenant REST API that backs the dashboard, public form endpoints, and asynchronous workflow generation hooks.
- Organized by domain under `src/domains/*` so controllers, services, routes, and handlers stay co-located.
- Typed API contracts live in `frontend/src/lib/api/contracts.ts` and are documented in `docs/contracts/README.md`.

## Layout Cheat Sheet

| Path | What lives there |
| --- | --- |
| `src/domains/workflows` | Workflows controllers/services/routes + workflow generation handlers. |
| `src/domains/forms` | Form CRUD + AI CSS helpers and public form routes. |
| `src/domains/impersonation` | Impersonation controller + routes. |
| `src/routes` | Registry (`routes/index.ts`) plus shared routers/middleware. |
| `src/utils` | Shared Dynamo, auth, validation, logging utilities (still referenced via `@utils/*`). |
| `src/services` | Cross-domain helpers that have not moved into `domains` yet (auth, analytics, usage, templates, etc.). |

## Commands

```bash
# Install deps (once)
cd backend/api
npm install

# Type-check + build (tsc + tsc-alias rewrite)
npm run build

# Local watch + lambda-style dev server
npm run dev     # build + node server-local.js
npm run watch   # tsc -w + tsc-alias -w

# Jest/unit tests (where available)
npm test
```

## Implementation Notes

- Path aliases (`@domains/*`, `@utils/*`, etc.) are defined in `backend/api/tsconfig.json`. `tsc-alias` rewrites them for the emitted JS bundle.
- Workflow + form services were moved under `src/domains/*/services`—import them via `@domains/<domain>/services/...`.
- The Lambda entry point (`src/index.ts`) registers routes and imports `handleWorkflowGenerationJob` from the workflow domain.
- When adding new endpoints, update:
  1. Domain route + controller.
  2. `docs/contracts/README.md`.
  3. `frontend/src/lib/api/contracts.ts` plus the matching client in `frontend/src/lib/api/*.client.ts`.

## Debug Tips

- For route wiring issues, set breakpoints/logs inside `src/routes/router.ts` and the domain `register*Routes` function.
- Dynamo table names are sourced from `src/utils/env.ts`; use `logger` from `@utils/logger` so logs surface in CloudWatch.
- Use `npm run dev` (Fastify local server) for HTTP testing or execute `node test-local.ts` with crafted events to simulate API Gateway payloads.
