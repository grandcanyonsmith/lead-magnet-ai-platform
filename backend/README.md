# Backend Directory Structure

This directory contains the backend services for the Lead Magnet AI Platform, organized into two main components: the API server and the worker service.

## Directory Structure

```
backend/
├── api/                    # API server (TypeScript/Node.js)
│   ├── src/
│   │   ├── controllers/   # Request handlers and business logic
│   │   ├── handlers/      # Lambda/API Gateway handlers
│   │   ├── middleware/    # Express middleware (auth, validation, etc.)
│   │   ├── routes/        # API route definitions
│   │   ├── services/      # Business logic services
│   │   ├── types/         # TypeScript type definitions
│   │   ├── utils/         # Utility functions
│   │   └── __tests__/     # Unit tests
│   ├── tests/             # Integration and E2E tests
│   ├── docs/              # API documentation
│   ├── dist/              # Compiled JavaScript (generated)
│   ├── bundle/            # Bundled artifacts (generated)
│   ├── index.js           # Entry point
│   ├── server-local.js    # Local development server
│   └── package.json       # Node.js dependencies
│
└── worker/              # Lambda worker (Python)
    ├── core/              # Core service modules
    │   ├── ai_service.py
    │   ├── artifact_service.py
    │   ├── cost_service.py
    │   ├── db_service.py
    │   ├── delivery_service.py
    │   ├── s3_service.py
    │   ├── template_service.py
    │   └── dependency_resolver.py
    ├── services/          # Specialized service modules
    │   ├── ai_step_processor.py
    │   ├── browser_service.py
    │   ├── context_builder.py
    │   ├── cua_loop_service.py
    │   ├── error_handler_service.py
    │   ├── execution_step_manager.py
    │   ├── job_completion_service.py
    │   ├── openai_client.py
    │   ├── step_processor.py
    │   ├── workflow_orchestrator.py
    │   └── ... (other service modules)
    ├── tests/             # Test files
    ├── utils/             # Utility modules
    ├── types/             # Type definitions
    ├── model_types/       # Data model types
    ├── processor.py       # Main job processor
    ├── worker.py          # Worker entry point
    ├── lambda_handler.py  # Lambda function handler
    ├── requirements.txt   # Python dependencies
    └── Dockerfile         # Container definition
```

## API Server (`api/`)

The API server is a TypeScript/Node.js application that provides REST endpoints for the platform.

### Key Components

- **Controllers** (`src/controllers/`): Handle HTTP requests and coordinate business logic
- **Services** (`src/services/`): Business logic and data processing
- **Routes** (`src/routes/`): API route definitions and middleware
- **Middleware** (`src/middleware/`): Authentication, validation, rate limiting, etc.
- **Utils** (`src/utils/`): Shared utility functions

### Entry Points

- `index.js`: Main Lambda handler entry point
- `server-local.js`: Local development server

### Testing

- `src/__tests__/`: Unit tests
- `tests/`: Integration and E2E tests

## Worker Service (`worker/`)

The worker service is a Python Lambda function that processes jobs asynchronously.

### Key Components

- **Core Services** (`core/`): Fundamental service modules that provide core functionality
  - `ai_service.py`: AI/LLM integration
  - `artifact_service.py`: Artifact creation and management
  - `db_service.py`: Database operations
  - `s3_service.py`: S3 storage operations
  - `delivery_service.py`: Delivery/notification services
  - `cost_service.py`: Cost calculation
  - `template_service.py`: Template processing
  - `dependency_resolver.py`: Dependency resolution

- **Specialized Services** (`services/`): Domain-specific service modules
  - Step processors, workflow orchestration, error handling, etc.

- **Utils** (`utils/`): Utility functions and helpers

- **Types** (`types/`, `model_types/`): Type definitions and data models

### Entry Points

- `lambda_handler.py`: AWS Lambda function handler
- `worker.py`: Standalone worker entry point
- `processor.py`: Main job processing logic

### Testing

- `tests/`: All test files (unit, integration, E2E)

## Import Patterns

### API (TypeScript)

```typescript
// Relative imports within src/
import { SomeService } from '../services/someService';
import { SomeType } from '../types/someType';
```

### Worker (Python)

```python
# Core services (from core package)
from core.ai_service import AIService
from core.db_service import DynamoDBService

# Specialized services (from services package)
from services.step_processor import StepProcessor
from services.workflow_orchestrator import WorkflowOrchestrator

# Utils
from utils.some_util import some_function

# Types
from types.some_type import SomeType
```

## Development

### API Development

```bash
cd api
npm install
npm run dev          # Local development
npm test             # Run tests
npm run build        # Build for production
```

### Worker Development

```bash
cd worker
pip install -r requirements.txt
python test_local.py  # Run local tests
```

## Build Artifacts

The following directories are generated and should not be edited directly:

- `api/dist/`: Compiled TypeScript
- `api/bundle/`: Bundled Lambda artifacts
- `worker/__pycache__/`: Python bytecode cache

## Notes

- The `core/` directory in the worker contains fundamental services that are used throughout the application
- The `services/` directory contains more specialized, domain-specific services
- Test files are organized in dedicated `tests/` directories for better separation of concerns
- All imports have been updated to reflect the new organized structure

