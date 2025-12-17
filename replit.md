# Lead Magnet AI Platform

## Overview
This project is an AI-powered, multi-tenant platform for generating lead magnets. It uses Next.js for the frontend, a Node.js/TypeScript backend with AWS Lambda, and a Python AI worker with OpenAI. The platform offers tools for managing workflows, forms, jobs, and generated content, focusing on real-time execution tracking and analytics. The goal is to enable users to efficiently create high-quality lead magnets, leveraging automated content generation and lead acquisition.

## User Preferences
None documented yet - this section will be updated as preferences are established.

## System Architecture

### UI/UX Decisions
The frontend is built with Next.js 14 and React 18, using Tailwind CSS. It features a dashboard for managing workflows, forms, jobs, and artifacts, real-time job execution tracking with inline editing, workflow visualization via React Flow, and analytics dashboards with Recharts. It includes a gallery view for artifacts with previews, pagination, and filtering, and provides responsive design with toast notifications. Secure HTML rendering for job outputs is supported, with a toggle between rendered and source views within a secure iframe.

### Technical Implementations
The project is an npm monorepo comprising:
- **Frontend**: A Next.js 14 application (`frontend/`) handling the UI, user authentication via AWS Cognito, and interaction with the backend API.
- **Backend API**: An Express-based Node.js/TypeScript application (`backend/api/`) deployed as AWS Lambda functions, providing APIs for workflow, form, job, S3 artifact, and DynamoDB management.
- **Worker**: A Python application (`backend/worker/`) for AI-powered job processing, utilizing OpenAI and deployed as an AWS Lambda container image (stored in ECR).
- **Infrastructure**: AWS CDK definitions (`infrastructure/`) in TypeScript for managing AWS resources like authentication, API Gateway, databases, storage, and compute services.

### Feature Specifications
- **Authentication**: AWS Cognito for user authentication using JWT tokens.
- **Data Handling**: Zod for validation (frontend & backend) and DynamoDB as the primary database.
- **Workflow Management**: Users can define, track, and edit complex workflows.
- **Artifact Management**: Generated content (artifacts) are stored in S3 with a dedicated management interface.
- **Job Processing**: Asynchronous job execution orchestrated by AWS Step Functions and processed by AI workers.
- **Inline Step Editing**: Direct modification of workflow steps during job execution.
- **Job Execution Display**: Shows previous step context and current step input/output side-by-side.
- **AI-Powered Workflow Editing**:
  - **Step-Level AI**: Natural language editing for individual workflow steps with diff preview.
  - **Workflow-Level AI**: AI-driven restructuring of entire workflows (add, remove, modify, reorder steps) using natural language prompts, with server-side validation and normalization.

#### System Design Choices
- **Monorepo**: For shared code and consistent tooling.
- **Serverless Architecture**: AWS Lambda for scalable and cost-effective services.
- **Cloud-Native**: Deep integration with AWS services.
- **OpenAI Integration**: Central to AI processing.
- **Separation of Concerns**: Clear distinction between frontend, backend API, worker, and infrastructure.
- **Production Deployment**: Frontend configured for Replit Autoscale deployments (port 80), with backend services on AWS.

### Debugging Tools
- **Local Job Execution**: Python test script (`backend/worker/test_local.py`) for running jobs locally with full debug output
- **Debug Guide**: Comprehensive debugging documentation in `DEBUG_JOBS.md`
- **LSP Diagnostics**: TypeScript type checking to catch errors before deployment

## External Dependencies

- **AWS Cognito**: User authentication.
- **AWS DynamoDB**: Main database.
- **AWS S3**: Storage for artifacts and static assets.
- **AWS Lambda**: Serverless compute.
- **AWS Step Functions**: Workflow orchestration.
- **AWS API Gateway**: API exposure.
- **OpenAI API**: AI model integration.
- **Next.js**: Frontend framework.
- **React**: UI library.
- **Tailwind CSS**: CSS framework.
- **React Flow**: Interactive diagrams.
- **Recharts**: Charting library.
- **Axios**: HTTP client.
- **React Hook Form / Zod**: Form management and validation.
- **react-hot-toast**: Toast notifications.