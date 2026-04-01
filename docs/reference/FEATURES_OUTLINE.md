# Features and sub-features outline

This outline summarizes the product and operational features visible in the
frontend, backend worker, and README documentation. Each item lists what it
does and the sub-features that enable it.

## 1. Account, access, and tenancy
- Authentication and access control
  - Login and signup flows for user access.
  - Role-based access (USER, ADMIN, SUPER_ADMIN).
  - Multi-tenant isolation to keep customer data separated.
- Onboarding and billing setup
  - Onboarding survey to collect business context.
  - Billing setup flow to start subscription and usage tracking.
- Agency administration
  - Agency view vs. subaccount view switcher for SUPER_ADMINs.
  - User management across accounts (search, role edits, copy customer ID).
  - Impersonation to troubleshoot customer accounts.

## 2. Dashboard and analytics
- Executive dashboard
  - High-level KPIs (jobs, submissions, workflows, success rate).
  - Usage trends and recent activity.
  - Quick actions to create lead magnets or adjust settings.

## 3. Lead magnet (workflow) management
- Lead magnet list and organization
  - List view with search and filters.
  - Folder organization with create/manage flows.
- New lead magnet wizard (AI assisted)
  - Wizard entry flow (choice, chat, prompt, form).
  - ICP profile selection and research.
  - AI ideation and mockup generation.
  - Final workflow generation from wizard outputs.
- Workflow editor (core builder)
  - Tabbed editor for workflow, form, and template.
  - Flowchart to visualize and reorder steps.
  - Step editing with move, duplicate, and delete actions.
  - Validation to ensure steps and instructions are complete.
- Workflow triggers
  - Form submission trigger for public forms.
  - Webhook trigger for API-driven execution.
- Step configuration (AI and integrations)
  - Step basics: name and description.
  - Model config: model selection, reasoning depth, service tier.
  - Instructions editor with markdown preview and expanded editor.
  - Output settings: deliverable step, output type, verbosity, token cap.
  - Dependencies: step ordering and include form data.
  - Integrations: webhook/API step and handoff to another workflow.
  - AI assist: generate or refine step instructions.
  - Step tester: run step previews and stream logs.
- Tooling for AI steps
  - Web search for real-time research.
  - File search across uploaded documents.
  - Code interpreter for Python data processing.
  - Image generation for visual assets.
  - Computer use (beta) for UI-driven tasks.
  - Shell tool with safety limits and output caps.
  - MCP servers to connect external tool providers.
- Workflow versioning and history
  - Version list with metadata and restore capability.
  - Version details with step summaries.
  - Version-linked job runs and artifact previews.
- Workflow improvement review
  - AI improvement history with status tracking.
  - Compare configuration steps and generated HTML outputs.
  - Approve or deny suggested improvements.

## 4. Template management and editing
- Template CRUD and versioning
  - Create and edit HTML templates linked to workflows.
  - Versioned updates and rollback support.
- Template editor experience
  - Split, editor-only, and preview modes.
  - Device previews (mobile/tablet/desktop).
  - Element selection for targeted edits.
  - HTML formatting and undo/redo history.
  - AI-based template refinement prompts.
- Output editor for generated artifacts
  - Full-page editor to patch HTML deliverables.
  - Selection-based editing and AI patching.
  - Save changes to job output or promote to template.

## 5. Forms and lead capture
- Form builder
  - Custom field types (text, textarea, select, number, url, file, etc.).
  - Required flags, placeholders, and options for selects.
  - Public slug and URL generation (custom domain aware).
  - Rate limiting and CAPTCHA protection.
  - Thank-you message, redirect URL, and custom CSS.
- Public forms
  - Public form endpoints for lead submission.
  - Collects name, email, phone, plus custom fields.

## 6. Lead processing (jobs) and results
- Job list and filtering
  - Filter by status and workflow.
  - Search, sorting, and pagination.
  - Auto-refresh while jobs are processing.
- Job detail view
  - Overview of generated outputs and artifacts.
  - Execution tab with step-by-step status and logs.
  - Resubmit jobs and rerun individual steps.
  - Improve tab for AI workflow improvement history.
  - Edit tab to jump into workflow editor.
  - Activity tab with tracking stats and session recordings.
  - Technical tab with raw inputs, artifacts, and debug data.

## 7. Delivery, integrations, and logs
- Webhook delivery
  - Dynamic payloads and headers on completion.
  - Webhook token management and tester.
  - Webhook logs with filtering, full payload inspection, and retry.
- SMS delivery (Twilio)
  - Manual SMS templates with placeholders.
  - AI-generated SMS content from workflow context.
  - Twilio credential management via secrets.
- CRM integration
  - Webhook integration endpoint for CRM pipelines.
- Workflow handoff
  - Send outputs to another workflow for multi-stage pipelines.

## 8. Artifacts and files
- Artifacts library (downloads)
  - List and filter generated artifacts.
  - Full-screen previews and metadata.
  - Download actions for outputs and assets.
- Job-level artifact previews
  - HTML, PDF, image, and log previews from executions.
- Document library (file search)
  - Upload and manage documents for AI steps.
  - Search document content.
  - Download and delete files.

## 9. Playground and experimentation
- Playground workspace
  - Import an existing workflow.
  - Configure steps and run in isolation.
  - Provide JSON inputs and review live logs.
  - Inspect accumulated context across steps.

## 10. Settings and configuration
- General settings
  - Organization profile and contact info.
  - Default AI model, tool usage, service tier, verbosity.
  - Default image generation settings.
  - Workflow improvement reviewer defaults.
  - Tool secrets injected into tool runs.
- Branding settings
  - Logo and visual identity controls.
  - Brand voice, tone, and messaging guidelines.
  - ICP document URL for additional context.
- Delivery settings
  - Webhook URL and token regeneration.
  - CRM webhook for delivery automation.
  - Custom domain setup and DNS guidance.
  - Lead phone field mapping and Cloudflare integration.
- Prompt overrides
  - Per-tenant prompt customization with search and JSON editor.
  - Enable/disable overrides and apply default templates.
- Billing and usage
  - Subscription status and Stripe portal access.
  - Usage analytics and exportable reports.

## 11. Reliability and security controls
- Rate limiting and spam protection on forms.
- Secure storage (S3/DynamoDB) with public artifact delivery via CDN.
- JWT authentication with tenant-scoped access.
