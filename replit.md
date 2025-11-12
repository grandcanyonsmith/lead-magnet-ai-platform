# Lead Magnet AI Platform

## Overview
This project is an AI-powered, multi-tenant platform for generating lead magnets. It leverages Next.js for the frontend, a Node.js/TypeScript backend utilizing AWS Lambda, and a Python worker for AI processing with OpenAI. The platform provides tools for managing workflows, forms, jobs, and generated artifacts, with a focus on real-time execution tracking and analytics. The business vision is to empower users to efficiently create high-quality lead magnets, tapping into market potential for automated content generation and lead acquisition.

## User Preferences
None documented yet - this section will be updated as preferences are established.

## System Architecture

### UI/UX Decisions
The frontend is built with Next.js 14 and React 18, utilizing Tailwind CSS for styling. Key UI features include:
- A comprehensive dashboard for managing workflows, forms, jobs, and artifacts.
- Real-time job execution tracking with detailed step-by-step progress.
- Workflow visualization powered by React Flow.
- Analytics dashboards with Recharts.
- Modern design patterns for artifact display, including a gallery view with previews, pagination, and filtering.
- Intuitive inline editing for workflow steps within the job execution view.
- Responsive design ensuring usability across various devices.
- Toast notifications for user feedback.

### Technical Implementations
The project is structured as an npm monorepo with the following components:
- **Frontend**: A Next.js 14 application (`frontend/`) serving the user interface on port 5000 (for development) or 80 (for production autoscale). It handles user authentication via AWS Cognito, manages state, and interacts with the backend API.
- **Backend API**: An Express-based Node.js/TypeScript application (`backend/api/`) deployed as AWS Lambda functions. It provides APIs for workflow management, form/template handling, job coordination, S3 artifact management, and DynamoDB operations.
- **Worker**: A Python application (`backend/worker/`) designed for AI-powered job processing, primarily utilizing OpenAI. It is deployed as AWS Lambda/ECS workers.
- **Infrastructure**: AWS CDK definitions (`infrastructure/`) written in TypeScript to manage the deployment of AWS resources including authentication, API Gateway, databases, storage, and compute services.

### Feature Specifications
- **Authentication**: AWS Cognito is used for user authentication, employing JWT tokens and client-side authentication state management.
- **Data Handling**: Zod is used for validation on both frontend (React Hook Form) and backend. DynamoDB is the primary database.
- **Workflow Management**: Users can define and track complex workflows.
- **Artifact Management**: Generated content (artifacts) are stored in S3 and managed through a dedicated interface with preview capabilities.
- **Job Processing**: Asynchronous job execution coordinated by AWS Step Functions, processed by AI workers.
- **Inline Step Editing**: Allows direct modification of workflow steps during job execution, preserving metadata and providing immediate feedback.
- **Job Execution Display**: Redesigned to show previous step context and current step input/output side-by-side, with clear progress indicators.
- **AI-Powered Workflow Editing**: 
  - **Step-Level AI**: Natural language editing for individual workflow steps with diff preview and accept/reject flow
  - **Workflow-Level AI**: Complete workflow restructuring with AI - add, remove, modify, or reorder multiple steps at once using natural language prompts
  - Both AI features use validated, normalized responses to prevent data corruption

### System Design Choices
- **Monorepo**: Facilitates shared code, consistent tooling, and streamlined development across different components.
- **Serverless Architecture**: Utilizes AWS Lambda for scalable and cost-effective backend and worker services.
- **Cloud-Native**: Deep integration with AWS services for core infrastructure.
- **OpenAI Integration**: Central to the AI processing capabilities of the platform.
- **Separation of Concerns**: Clear distinction between frontend, backend API, worker, and infrastructure layers.
- **Production Deployment**: Configured for Replit Autoscale deployments for the frontend, listening on port 80 and binding to `0.0.0.0`. Backend services continue to run on AWS.

## External Dependencies

- **AWS Cognito**: User authentication and authorization.
- **AWS DynamoDB**: Main database for persistent data storage.
- **AWS S3**: Storage for generated artifacts and other static assets.
- **AWS Lambda**: Serverless compute for backend API and worker functions.
- **AWS Step Functions**: Orchestration of complex, multi-step workflows.
- **AWS API Gateway**: Exposing backend APIs.
- **OpenAI API**: AI model integration for content generation and processing.
- **Next.js**: Frontend web framework.
- **React**: Frontend UI library.
- **Tailwind CSS**: Utility-first CSS framework.
- **React Flow**: Library for building interactive diagrams and visualizations.
- **Recharts**: Charting library for analytics.
- **Axios**: HTTP client for API calls.
- **React Hook Form / Zod**: Form management and validation.
- **react-hot-toast**: For toast notifications.

## Recent Changes

### Workflow-Level AI Editing (November 11, 2025)
**Feature**: Added AI-powered workflow restructuring capability that allows users to modify entire workflows with natural language
**User Request**: "Add a generate with AI prompt that will edit the entire thing not just one step at a time"

#### Changes Made:
1. **Backend Service** (`backend/api/src/services/workflowAIService.ts`):
   - Created `WorkflowAIService` for whole-workflow AI editing
   - Uses OpenAI GPT-4o to interpret natural language prompts
   - Supports adding, removing, modifying, and reordering steps
   - Validates and normalizes all AI-generated steps using `ensureStepDefaults`
   - Runs `validateDependencies` to ensure step dependencies are valid
   - Returns structured proposals with workflow metadata and step changes

2. **Backend Controller & Routes** (`backend/api/src/controllers/workflows.ts`, `backend/api/src/routes.ts`):
   - Added `aiEditWorkflow` controller method
   - Created POST `/admin/workflows/:id/ai-edit` endpoint
   - Validates user permissions and workflow existence
   - Returns normalized, validated proposals only

3. **Frontend API Client** (`frontend/src/lib/api/workflows.client.ts`, `frontend/src/lib/api/index.ts`):
   - Added `editWorkflowWithAI` method to WorkflowsClient
   - Integrated into main API client for easy access

4. **Frontend Hook** (`frontend/src/hooks/useWorkflowAI.ts`):
   - Created `useWorkflowAI` hook for state management
   - Handles API calls, loading states, and error handling
   - Manages proposal lifecycle (generate → review → accept/reject)

5. **WorkflowDiffPreview Component** (`frontend/src/components/workflows/edit/WorkflowDiffPreview.tsx`):
   - Displays comprehensive diff of all proposed changes
   - Shows workflow metadata changes (name, description, HTML setting)
   - Color-coded step changes: green (new), yellow (modified), red (removed)
   - Displays model, tools, and dependencies for each step
   - Accept/reject actions with loading states

6. **WorkflowTab UI Integration** (`frontend/src/components/workflows/edit/WorkflowTab.tsx`):
   - Added collapsible "AI Workflow Assistant" panel with purple gradient styling
   - Prominent placement between workflow settings and steps
   - Natural language prompt input with example suggestions
   - Validates proposals before applying to prevent data corruption
   - Preserves proposals on error for user recovery
   - Success/error feedback via toast notifications

7. **EditWorkflowPage Updates** (`frontend/src/app/dashboard/workflows/[id]/edit/page-client.tsx`):
   - Passed `workflowId` and `onStepsChange` props to WorkflowTab
   - Enables workflow-level AI editing in the edit flow

#### Technical Details:
- **Validation Pipeline**: AI responses → sanitize models/tools → `ensureStepDefaults` → `validateDependencies` → client
- **Required Fields**: All steps get `step_id`, `step_group`, `step_order`, and other defaults before reaching frontend
- **Error Recovery**: Frontend validates proposals before applying; keeps proposal visible on error so user can reject
- **State Management**: Changes applied to local state only; user must click "Save Changes" to persist
- **Security**: All proposals validated server-side; malformed AI responses rejected before reaching client

#### Architect Review:
✅ **Approved** - Production-ready
- Normalization and validation prevent data corruption
- Frontend guards against corrupt proposals
- Error handling provides user recovery path
- No security vulnerabilities observed

### Changes from November 10, 2025

### Deployment Fixes & React Hooks Compliance (Evening - 23:20 UTC)
**Issue**: Deployment failing due to React Hooks violations and incorrect run command
**Root Cause**: StepContent.tsx had early returns after calling hooks, violating React's Rules of Hooks

#### Changes Made:
1. **Fixed React Hooks Violation** (`frontend/src/components/jobs/StepContent.tsx`):
   - **Problem**: Component had multiple early returns based on `formatted.type` after calling `useState` hooks
   - **Solution**: Refactored to use helper functions (`renderJsonContent`, `renderHtmlContent`, etc.) with single return statement
   - All hooks now called at top level before any conditional logic
   - Maintains exact same functionality and UI behavior
   - ESLint and TypeScript compilation pass without errors

2. **Fixed Deployment Configuration** (`.replit`):
   - Updated run command from incomplete `["npm"]` to complete `["npm", "start"]`
   - Ensures production server starts properly during deployment
   - Uses monorepo's start script which runs `npm run start:deploy --workspace frontend`

3. **Updated ESLint Configuration** (`frontend/next.config.js`):
   - Added `dirs: ['src']` to specify linting scope more clearly
   - Maintains strict error checking while allowing non-critical warnings

#### Technical Details:
- **React Hooks Rules**: All hooks must be called at the top level, never inside conditionals or after early returns
- **Build Verification**: ESLint, TypeScript, and Next.js compilation all pass successfully
- **Production Ready**: App now ready for deployment with proper autoscale configuration

### HTML Rendering & Complete Step Display (Evening - 22:31 UTC)
**Features**: Added secure HTML rendering for job outputs and fixed missing execution steps display
**User Issues**: HTML output not rendering, earlier completed steps not showing in execution view

#### Changes Made:
1. **HTML Rendering Support** (`frontend/src/components/jobs/StepContent.tsx`):
   - Added 'html' type support for rendering HTML outputs
   - Toggle between "Rendered" and "Source" views
   - Rendered view: Secure iframe with `sandbox="allow-same-origin"` and `referrerPolicy="no-referrer"`
   - Source view: Syntax-highlighted HTML code with expand/collapse
   - Security: Blocks ALL JavaScript execution while allowing external resources (fonts, images)
   - Privacy: `referrerPolicy="no-referrer"` prevents data leakage to third-party hosts

2. **HTML Detection** (`frontend/src/utils/jobFormatting.tsx`):
   - Added `isHTML()` function to detect HTML content
   - Checks for DOCTYPE, html tags, closing tags, and HTML comments
   - Updated `formatStepOutput()` to check HTML before JSON (correct priority)
   - Returns 'html' type when HTML content detected

3. **Fixed Missing Steps** (`frontend/src/app/dashboard/jobs/[id]/page-client.tsx`):
   - Complete rewrite of `getMergedSteps()` function
   - OLD: Only showed steps matching workflow.steps array + additional steps
   - NEW: Shows ALL execution steps from job.execution_steps first
   - Uses Map-based approach to ensure no steps are skipped
   - Enriches execution steps with workflow metadata where available
   - Handles edge case where workflow was edited after job execution

#### Technical Details:
- **Security**: `sandbox="allow-same-origin"` without `allow-scripts` prevents XSS attacks
  - JavaScript execution: ❌ Blocked (no `allow-scripts`)
  - External resources: ✅ Allowed (fonts, stylesheets, images load properly)
  - Form submission: ❌ Blocked
  - Top-level navigation: ❌ Blocked
  - Event handlers: ❌ Blocked (remain inert)
- **Privacy**: `referrerPolicy="no-referrer"` reduces metadata leakage to external resource hosts
- **Step Merging**: All execution steps populate mergedStepsMap first, then workflow metadata overlays
- **HTML Detection Order**: HTML → JSON → Markdown → Text (prevents HTML being parsed as JSON)
- **Trade-offs**: Interactive HTML (forms, scripts) won't work due to security restrictions

#### Architect Review:
✅ **Approved** - Production-ready
- Security: XSS blocked by disabling scripts; same-origin access safe without script capability
- Privacy: Referrer policy added to minimize data leakage
- Step merging: Correctly aggregates all execution steps
- External resources will load (fonts/images) which is expected behavior for proper rendering