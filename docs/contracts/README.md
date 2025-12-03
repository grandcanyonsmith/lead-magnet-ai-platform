# API Contracts

This directory provides a human-readable contract for the REST API that powers the lead magnet platform.  
It is the authoritative reference for AI assistants and engineers when wiring new features or debugging client calls.

## Base URL & Auth

- **Base URL:** `https://czp5b77azd.execute-api.us-east-1.amazonaws.com`
- **Stage:** All documented endpoints live under the default stage (`/`), so paths below are absolute.
- **Auth:** Every `/admin/*` route requires a Cognito JWT attached as `Authorization: Bearer <token>` plus the contextual headers inserted by `frontend/src/lib/api/base.client.ts`.
- **Tenancy:** `router.register` injects the tenant/customer context from the auth token; no manual tenant headers are needed unless you impersonate.

## Domain Overview

| Domain | Routes File | Controllers | Frontend Client |
| --- | --- | --- | --- |
| Workflows | `backend/api/src/domains/workflows/routes/workflowRoutes.ts` | `workflowsController`, `workflowAIController`, `workflowValidationController` | `frontend/src/lib/api/workflows.client.ts` |
| Forms | `backend/api/src/domains/forms/routes/formRoutes.ts` & `backend/api/src/routes/publicRoutes.ts` | `formsController`, `formAIController` | `frontend/src/lib/api/forms.client.ts` |
| Jobs & Execution | `backend/api/src/routes/jobRoutes.ts` | `jobsController`, `executionStepsController`, `jobRerunController` | `frontend/src/lib/api/jobs.client.ts` |
| Templates | `backend/api/src/routes/templateRoutes.ts` | `templatesController` | `frontend/src/lib/api/templates.client.ts` |
| Notifications | `backend/api/src/routes/adminRoutes.ts` | `notificationsController` | `frontend/src/lib/api/notifications.client.ts` |
| Settings & Analytics | `backend/api/src/routes/settings.ts`, `routes/adminRoutes.ts` | `settingsController`, `analyticsController` | `frontend/src/lib/api/settings.client.ts`, `analytics.client.ts` |
| Webhook Logs | `backend/api/src/routes/webhookRoutes.ts` | `webhookLogsController` | `frontend/src/lib/api/webhookLogs.client.ts` |

The companion machine-readable mapping that ties these endpoints to request/response types lives in `frontend/src/lib/api/contracts.ts`.

## Workflows

| Method & Path | Description | Handler | Client |
| --- | --- | --- | --- |
| `GET /admin/workflows` | List workflows for the authenticated tenant (supports `status`, `limit` query params). | `workflowsController.list` | `WorkflowsClient.getWorkflows` |
| `POST /admin/workflows` | Create a workflow draft with validated steps. | `workflowsController.create` | `WorkflowsClient.createWorkflow` |
| `GET /admin/workflows/:id` | Fetch a workflow with current form metadata. | `workflowsController.get` | `WorkflowsClient.getWorkflow` |
| `PUT /admin/workflows/:id` | Update workflow metadata or steps. | `workflowsController.update` | `WorkflowsClient.updateWorkflow` |
| `DELETE /admin/workflows/:id` | Soft-delete a workflow. | `workflowsController.delete` | `WorkflowsClient.deleteWorkflow` |
| `POST /admin/workflows/generate-with-ai` | Launch asynchronous workflow generation (returns job id). | `workflowAIController.generateWithAI` | `WorkflowsClient.generateWorkflowWithAI` |
| `GET /admin/workflows/generation-status/:jobId` | Poll workflow generation job status. | `workflowAIController.getGenerationStatus` | `WorkflowsClient.getWorkflowGenerationStatus` |
| `POST /admin/workflows/:id/ai-step` | Generate or update a specific step with AI assistance. | `workflowAIController.aiGenerateStep` | `WorkflowsClient.generateStepWithAI` |
| `POST /admin/workflows/:id/ai-edit` | Ask AI to edit an entire workflow. | `workflowAIController.aiEditWorkflow` | `WorkflowsClient.editWorkflowWithAI` |
| `POST /admin/workflows/refine-instructions` | Refine workflow instructions globally. | `workflowAIController.refineInstructions` | `WorkflowsClient.refineInstructions` |

## Forms

| Method & Path | Description | Handler | Client |
| --- | --- | --- | --- |
| `GET /admin/forms` | List admin forms (`limit` query supported). | `formsController.list` | `FormsClient.getForms` |
| `POST /admin/forms` | Create a form bound to a workflow. | `formsController.create` | `FormsClient.createForm` |
| `GET /admin/forms/:id` | Fetch a form (tenant scoped). | `formsController.get` | `FormsClient.getForm` |
| `PUT /admin/forms/:id` | Update a form, including schema and rate limits. | `formsController.update` | `FormsClient.updateForm` |
| `DELETE /admin/forms/:id` | Soft delete a form (only allowed when detached). | `formsController.delete` | `FormsClient.deleteForm` |
| `POST /admin/forms/generate-css` | Generate CSS via AI. | `formAIController.generateCSS` | `FormsClient.generateFormCSS` |
| `POST /admin/forms/refine-css` | Refine CSS via AI. | `formAIController.refineCSS` | `FormsClient.refineFormCSS` |
| `GET /v1/forms/:slug` | Public form definition fetch (no auth). | `formsController.getPublicForm` via `publicRoutes` | `FormsClient.getPublicForm` |
| `POST /v1/forms/:slug/submit` | Public form submission, triggers workflow job. | `formsController.submitForm` via `publicRoutes` | `FormsClient.submitPublicForm` |

## Jobs & Execution

| Method & Path | Description | Handler | Client |
| --- | --- | --- | --- |
| `GET /admin/jobs` | List jobs (`status`, `workflow_id`, pagination` supported). | `jobsController.list` | `JobsClient.getJobs` |
| `GET /admin/jobs/:id` | Fetch a single job with execution status. | `jobsController.get` | `JobsClient.getJob` |
| `POST /admin/jobs/:id/resubmit` | Resubmit a failed job. | `jobsController.resubmit` | `JobsClient.resubmitJob` |
| `POST /admin/jobs/:id/rerun-step` | Re-run a specific execution step. | `jobRerunController.rerunStep` | `JobsClient.rerunStep` |
| `POST /admin/jobs/:id/quick-edit-step` | Quick edit a step output with AI. | `executionStepsController.quickEditStep` | `JobsClient.quickEditStep` |
| `GET /admin/jobs/:id/document` | Fetch rendered document (HTML/Markdown). | `jobsController.getDocument` | `JobsClient.getJobDocument` |
| `GET /admin/jobs/:id/execution-steps` | Fetch execution step metadata/logs. | `executionStepsController.getExecutionSteps` | `JobsClient.getExecutionSteps` |

## Templates & Notifications (Snapshot)

| Method & Path | Description | Handler | Client |
| --- | --- | --- | --- |
| `GET /admin/templates` | List HTML/asset templates. | `templatesController.list` | `TemplatesClient.getTemplates` |
| `POST /admin/templates` | Create template. | `templatesController.create` | `TemplatesClient.createTemplate` |
| `POST /admin/templates/generate-with-ai` | AI-generate template HTML. | `templatesController.generateWithAI` | `TemplatesClient.generateTemplateWithAI` |
| `GET /admin/notifications` | List notifications (optional `unreadOnly`). | `notificationsController.list` | `NotificationsClient.getNotifications` |
| `POST /admin/notifications/:id/mark-read` | Mark a notification as read. | `notificationsController.markRead` | `NotificationsClient.markNotificationRead` |

## Settings & Analytics (Snapshot)

| Method & Path | Description | Handler | Client |
| --- | --- | --- | --- |
| `GET /admin/settings` | Fetch tenant settings & onboarding info. | `settingsController.getSettings` | `SettingsClient.getSettings` |
| `PUT /admin/settings` | Update general branding/delivery settings. | `settingsController.updateSettings` | `SettingsClient.updateSettings` |
| `POST /admin/settings/onboarding-survey` | Persist onboarding survey. | `settingsController.updateOnboardingSurvey` | `SettingsClient.updateOnboardingSurvey` |
| `GET /admin/analytics` | Fetch usage/analytics summaries. | `analyticsController.getAnalytics` | `AnalyticsClient.getAnalytics` |
| `GET /admin/usage` | Token/cost usage trends. | `usageController.getUsage` | `UsageClient.getUsage` |

### Keeping Docs & Clients in Sync

1. Update this file whenever new routes are added or shape changes so AI assistants always know where to look.
2. Update `frontend/src/lib/api/contracts.ts` to describe the request/response types for the new route.
3. Ensure the typed client under `frontend/src/lib/api/*.client.ts` exposes the new endpoint and surface it through `frontend/src/lib/api/index.ts`.

With this workflow the written contract (docs), typed contract map (code), and runtime client stay aligned.
