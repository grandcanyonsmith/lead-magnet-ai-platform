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

## Recent Changes (November 10, 2025)

### HTML Rendering & Complete Step Display (Evening - 22:31 UTC)
**Features**: Added secure HTML rendering for job outputs and fixed missing execution steps display
**User Issues**: HTML output not rendering, earlier completed steps not showing in execution view

#### Changes Made:
1. **HTML Rendering Support** (`frontend/src/components/jobs/StepContent.tsx`):
   - Added 'html' type support for rendering HTML outputs
   - Toggle between "Rendered" and "Source" views
   - Rendered view: Secure iframe with empty sandbox attribute (no script execution)
   - Source view: Syntax-highlighted HTML code with expand/collapse
   - Security: `sandbox=""` provides complete isolation - no XSS risk
   - HTML renders visually but cannot execute scripts or access parent origin

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
- **Security**: Empty iframe sandbox (`sandbox=""`) prevents script execution and same-origin access
- **Step Merging**: All execution steps populate mergedStepsMap first, then workflow metadata overlays
- **HTML Detection Order**: HTML → JSON → Markdown → Text (prevents HTML being parsed as JSON)
- **Trade-offs**: Interactive HTML (forms, scripts, links) won't work due to security restrictions

#### Architect Review:
✅ **Approved** - Production-ready
- Security: XSS risk eliminated with proper iframe isolation
- Step merging: Correctly aggregates all execution steps
- Recommended: Manual QA with real job data for HTML rendering and step ordering