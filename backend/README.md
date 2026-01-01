# Backend Services

This directory contains the backend services for the Lead Magnet AI Platform.

## 🏗️ Components

### [API Service](./api/)
- **Technology**: Node.js / TypeScript
- **Framework**: Fastify (with Express adapter for Lambda)
- **Role**: Handles HTTP requests, authentication, and workflow management.
- **Entry Point**: `backend/api/server-local.js` (Local), Lambda Handler (Prod)

### [Worker Service](./worker/)
- **Technology**: Python 3.11
- **Role**: Executes AI workflows, processes jobs, and handles long-running tasks.
- **Entry Point**: `backend/worker/processor.py`

### [Shell Executor](./shell-executor/)
- **Technology**: Docker / Python
- **Role**: secure execution environment for code interpreter tools.

## 📚 Documentation

- [API Contracts](../../docs/reference/contracts/README.md)
- [Architecture Overview](../../docs/architecture/ARCHITECTURE.md)
- [Local Development](../../docs/guides/LOCAL_DEVELOPMENT.md)
