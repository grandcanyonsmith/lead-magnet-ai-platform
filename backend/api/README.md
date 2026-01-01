# API Service

The API Service is the interface for the Lead Magnet AI Platform. It handles user authentication, workflow management, form submissions, and job creation.

## 🏗️ Architecture

- **Runtime**: Node.js 20
- **Framework**: Fastify (wrapped for Lambda)
- **Database**: DynamoDB (via AWS SDK v3)
- **Auth**: Cognito JWT Validation

## 📂 Structure

- `src/domains/`: Domain-driven modules (workflows, forms, jobs).
  - `src/domains/workflows/`: Workflow CRUD and AI generation.
  - `src/domains/forms/`: Form schema and validation.
- `src/routes/`: Route definitions connecting controllers.
- `src/services/`: Shared business logic.
- `server-local.js`: Local Express server for development.

## 🚀 Local Development

```bash
# Install dependencies
npm install

# Start local server (port 3001)
npm run dev
```

The local server mimics the AWS Lambda environment and enables CORS for the frontend.

## 📚 API Documentation

See [API Contracts](../../docs/reference/contracts/README.md) for endpoint definitions.
