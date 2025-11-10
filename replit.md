# Lead Magnet AI Platform - Replit Migration

## Overview
Multi-tenant AI-powered lead magnet generation platform built with Next.js, AWS services (Cognito, DynamoDB, S3, Lambda, Step Functions), and OpenAI. Successfully migrated from Vercel to Replit on November 10, 2025.

## Project Architecture

### Frontend (Next.js 14)
- **Location**: `frontend/`
- **Framework**: Next.js 14.1.0 with React 18
- **Port**: 5000 (configured for Replit)
- **Key Features**:
  - AWS Cognito authentication
  - Dashboard for workflows, forms, jobs, and artifacts
  - Real-time job execution tracking
  - Workflow visualization with React Flow
  - Analytics and billing management

### Backend API (Node.js/TypeScript)
- **Location**: `backend/api/`
- **Type**: AWS Lambda functions (local dev server available)
- **Services**: Express-based API with AWS SDK integrations
- **Key Services**:
  - Workflow management
  - Form and template handling
  - Job processing coordination
  - S3 artifact management
  - DynamoDB operations

### Worker (Python)
- **Location**: `backend/worker/`
- **Type**: AWS Lambda/ECS workers
- **Purpose**: AI-powered job processing with OpenAI integration

### Infrastructure (AWS CDK)
- **Location**: `infrastructure/`
- **Type**: TypeScript-based CDK definitions
- **Manages**: Auth, API, Database, Storage, Compute stacks

## Replit Migration Changes

### Configuration Updates
1. **Frontend Scripts** (`frontend/package.json`):
   - Updated `dev` script: `next dev -p 5000 -H 0.0.0.0`
   - Updated `start` script: `next start -p 5000 -H 0.0.0.0`
   - Ensures proper binding to port 5000 for Replit environment

2. **Next.js Configuration** (`frontend/next.config.js`):
   - Removed Vercel-specific `output: 'export'` setting
   - Retained image optimization and environment variable passing
   - Enabled full Next.js dev server functionality

3. **Workflow Configuration**:
   - Configured single workflow: `dev` running Next.js on port 5000
   - Output type: webview for frontend preview

## Environment Variables

### Required Secrets (Configured in Replit)
- `NEXT_PUBLIC_API_URL`: AWS API Gateway endpoint
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`: Cognito User Pool ID
- `NEXT_PUBLIC_COGNITO_CLIENT_ID`: Cognito Client ID
- `NEXT_PUBLIC_AWS_REGION`: AWS region (e.g., us-east-1)

### Additional Variables (See `.env.example`)
The application requires additional AWS credentials and configuration for backend services when running locally or in production deployment.

## Development Workflow

### Running the Application
The workflow is pre-configured and runs automatically:
```bash
npm run dev  # From root (via workflow)
```

### Manual Development
```bash
# Install dependencies
npm install

# Frontend development
cd frontend && npm run dev

# Backend API development (local)
cd backend/api && npm run dev
```

### Monorepo Structure
This is an npm workspaces monorepo with:
- Root package.json managing workspace scripts
- Individual packages: frontend, backend/api, backend/worker, infrastructure

## Key Technologies

### Frontend Stack
- Next.js 14.1.0
- React 18
- TypeScript
- Tailwind CSS
- React Hook Form with Zod validation
- Axios for API calls
- React Flow for workflow visualization
- Recharts for analytics

### Backend Stack
- AWS Lambda + Express
- AWS SDK v3 (DynamoDB, S3, Step Functions)
- OpenAI API
- TypeScript
- Zod for validation

### Authentication
- AWS Cognito with amazon-cognito-identity-js
- JWT token-based authentication
- Client-side auth state management

## Security Practices

### Client/Server Separation
- Frontend runs on Replit (port 5000)
- Backend APIs run on AWS infrastructure
- Authentication via AWS Cognito
- API calls secured with Bearer tokens
- Environment variables managed through Replit Secrets

### Best Practices
- No hardcoded credentials
- Public environment variables prefixed with `NEXT_PUBLIC_`
- Secure token storage in localStorage
- Proper CORS handling between frontend and AWS API Gateway

## Recent Changes (November 10, 2025)

### Job Execution Steps UI Improvements (Evening - 20:41 UTC)
**Improvements**: Redesigned job execution steps display with better layout and context visibility
**User Request**: Replace tabbed Input/Output with side-by-side view and integrate previous step context

#### Changes Made:
1. **ExecutionSteps Component Refactor** (`frontend/src/components/jobs/ExecutionSteps.tsx`):
   - Removed separate "Context from Previous Steps" section
   - Replaced slidable Input/Output tabs with fixed two-column layout (responsive grid)
   - Added state management for collapsible previous steps dropdowns
   - Updated status icons: yellow spinner for processing (was blue), red X for failed
   - Side-by-side display on desktop, stacked on mobile

2. **New PreviousStepsContext Component** (`frontend/src/components/jobs/PreviousStepsContext.tsx`):
   - Collapsible accordion-style dropdowns for each previous step
   - Shows form submission data (Step 0) if available
   - Displays previous workflow steps with outputs and generated images
   - Parent-managed state to persist expansion across re-renders
   - Unique keys per step to prevent React reconciliation issues

3. **Job List Enhancements** (`frontend/src/app/dashboard/jobs/page.tsx`):
   - Added step progress counter (e.g., "Step 2/5") to job cards
   - Progress calculation accounts for failed jobs (stops at failed step)
   - Added status icons to both mobile and desktop views:
     - ✅ Green check for completed
     - ❌ Red X for failed
     - 🔄 Yellow spinner for processing
     - ✅ Yellow check for pending
   - New "Status" column in desktop table with icon + badge
   - Updated badge colors to match icon scheme (yellow for processing/pending)
   - Fixed React key warning with React.Fragment

#### Technical Details:
- Fixed two-column layout: Input (left) | Output (right) on desktop
- Input section includes collapsible previous steps context + current step input
- Output section shows current step output + generated images
- State management lifted to parent to prevent accordion re-initialization
- Responsive design with proper mobile stacking

### Downloads Page Redesign (Evening - 19:23 UTC)
**Improvements**: Transformed downloads/artifacts page from basic table to modern gallery
**User Request**: Better UI/UX with previews, pagination, and improved sorting

#### Changes Made:
1. **New Component Architecture** (`frontend/src/components/artifacts/`):
   - `PreviewRenderer`: Lazy-loaded preview rendering for images, PDFs, HTML, and text files
   - `PreviewCard`: Modern card layout with hover actions, metadata display, and file badges
   - `FiltersBar`: Search and filter controls for finding specific artifacts
   - `PaginationControls`: Smart pagination with page numbers and item count display

2. **Enhanced Artifacts Page** (`frontend/src/app/dashboard/artifacts/page.tsx`):
   - Replaced table with responsive card grid (1-4 columns based on screen size)
   - Client-side pagination (12 items per page)
   - Real-time search filtering by filename/artifact ID
   - Filter by artifact type
   - Maintained DESC sorting by created_at (most recent first)
   - Empty state with helpful messages
   - Improved loading states

3. **Key Features**:
   - Visual previews with lazy loading using IntersectionObserver
   - Hover animations revealing download/preview actions
   - Responsive design (mobile to desktop)
   - File type badges (PDF, JPG, HTML, etc.)
   - Relative time display (e.g., "2h ago", "3d ago")
   - File size formatting in human-readable units
   - Graceful fallbacks for missing data

#### Technical Details:
- Used Tailwind CSS for styling and animations
- Implemented lazy image loading to improve performance
- Sandboxed iframes for HTML previews
- PDF preview with embedded viewer
- Memoized filtering and pagination for performance

### Critical Backend Fixes (Evening - 17:21 UTC)
**Issue**: `code_interpreter` tool failing with "Invalid value" error  
**Root Cause**: Backend was using Chat Completions API which doesn't support `code_interpreter`  
**Solution**: Converted to OpenAI Responses API

#### Changes Made:
1. **OpenAI Client Migration** (`backend/worker/services/openai_client.py`):
   - Migrated from `client.chat.completions.create()` to `client.responses.create()`
   - Updated parameter structure: `instructions` + `input` (Responses API) vs `messages` array (Chat Completions)
   - Updated response parsing: `response.output_text` instead of `response.choices[0].message.content`
   - Added backwards compatibility fallbacks

2. **DynamoDB Decimal Fix** (`backend/worker/ai_service.py`):
   - Added comprehensive `convert_decimals_to_float()` after tool validation
   - Prevents "Object of type Decimal is not JSON serializable" errors
   - Normalizes all DynamoDB Decimal values at source before downstream processing

3. **Container Parameter Injection** (`backend/worker/services/tool_validator.py`):
   - Automatically injects `{"container": {"type": "auto"}}` for `code_interpreter` tool
   - Fixes "Missing required parameter: tools[0].container" errors

4. **Display Dimension Conversion** (`backend/worker/services/image_handler.py`):
   - Explicit `int()` conversion for display_width/display_height
   - Ensures Playwright receives integers instead of Decimal floats

#### Test Results:
- ✅ Local test confirmed `code_interpreter` works with Responses API
- ✅ Container parameter injection validated
- ✅ Decimal conversion prevents JSON serialization errors
- ✅ Successfully executed Python code (prime number calculation)

#### Deployment:
- Deployed via GitHub Actions at 17:21 UTC
- Build status: SUCCESS
- Lambda function updated with all fixes

### Migration Tasks Completed (Morning)
1. ✓ Verified Node.js installation (nodejs-20)
2. ✓ Updated frontend package.json for Replit compatibility
3. ✓ Modified Next.js config to remove static export
4. ✓ Installed all dependencies for monorepo
5. ✓ Configured environment variables
6. ✓ Set up workflow for Next.js dev server
7. ✓ Verified application runs without errors

### Application Status
- Development server running successfully on port 5000
- Next.js compilation completed without errors
- All frontend routes accessible
- AWS service integration ready (requires valid credentials)
- **Backend Lambda running OpenAI Responses API with code_interpreter support**

## Troubleshooting

### Common Issues
1. **Port conflicts**: Application is configured for port 5000 only
2. **Environment variables**: Ensure all required secrets are set in Replit
3. **AWS connectivity**: Verify AWS credentials and API Gateway accessibility
4. **Build errors**: Check workflow logs via Replit interface

### Log Access
- Workflow logs available in Replit console
- Next.js build output visible during compilation
- Browser console available in webview

## Production Deployment

### Replit Autoscale Deployment (November 10, 2025)
Configured for Replit Autoscale Deployments with the following setup:

**Deployment Configuration**:
- **Build Command**: `npm run build` (builds Next.js via workspace)
- **Run Command**: `npm start` (starts Next.js on port 80 for autoscale)
- **Deployment Target**: autoscale
- **Port**: Automatically uses PORT environment variable (defaults to 80)

**Key Scripts** (package.json):
- Root `build`: `npm run build --workspace frontend` - Uses npm workspaces to build frontend
- Root `start`: `npm run start:deploy --workspace frontend` - Uses deployment script
- Frontend `start:deploy`: `next start -p ${PORT:-80} -H 0.0.0.0` - Production server on port 80

**Changes Made for Autoscale**:
1. Added `start:deploy` script in `frontend/package.json` that uses port 80 (required for autoscale)
2. Updated root scripts to use npm workspace commands instead of shell wrappers
3. Removed redundant `npm install` from build script (platform handles dependencies)
4. Ensured Next.js server binds to `0.0.0.0` (required for autoscale)
5. Configured `output: 'standalone'` in `next.config.js` for optimized production builds

**Deployment Requirements**:
- Server must listen on port 80 (handled by PORT environment variable)
- Server must bind to `0.0.0.0` (not localhost)
- Application must be stateless (no persistent local state)
- Only one external port exposed

### AWS Deployment (Original)
This application was originally designed for AWS deployment via CDK:
- Frontend: Static export to S3 + CloudFront
- Backend: Lambda functions behind API Gateway
- Database: DynamoDB tables
- Storage: S3 buckets for artifacts

AWS infrastructure can be maintained for backend services while using Replit Autoscale for frontend hosting.

## Documentation
Additional documentation available in `docs/`:
- ARCHITECTURE.md - Detailed architecture overview
- LOCAL_DEVELOPMENT.md - Local development setup
- DEPLOYMENT.md - AWS deployment guide
- TROUBLESHOOTING.md - Common issues and solutions

## User Preferences
None documented yet - this section will be updated as preferences are established.
