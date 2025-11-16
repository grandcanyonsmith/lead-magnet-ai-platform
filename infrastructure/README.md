# Lead Magnet Infrastructure

AWS CDK infrastructure code for the Lead Magnet AI Platform.

## Overview

This directory contains the AWS CDK (Cloud Development Kit) code that defines and deploys all AWS resources for the Lead Magnet platform. The infrastructure is organized into multiple stacks, each responsible for a specific set of resources.

## Architecture

The infrastructure is organized into the following stacks:

### Foundation Stacks (No Dependencies)

1. **DatabaseStack** (`leadmagnet-database`)
   - Creates all DynamoDB tables required by the platform
   - Tables: workflows, forms, submissions, jobs, artifacts, templates, userSettings, usageRecords, notifications
   - Includes Global Secondary Indexes (GSIs) for efficient querying

2. **AuthStack** (`leadmagnet-auth`)
   - Creates Cognito User Pool and User Pool Client
   - Handles user authentication and authorization
   - Includes Lambda trigger for auto-confirming users

3. **StorageStack** (`leadmagnet-storage`)
   - Creates S3 bucket for storing artifacts (images, generated content)
   - Creates CloudFront distribution for CDN
   - Configures bucket policies for public image access

4. **WorkerStack** (`leadmagnet-worker`)
   - Creates ECR repository for Lambda container images
   - Required for Playwright-based Lambda functions (GLIBC compatibility)

### Application Stacks (Have Dependencies)

5. **ComputeStack** (`leadmagnet-compute`)
   - Creates Step Functions state machine for orchestrating job processing
   - Creates Lambda function for processing workflow jobs
   - Depends on: DatabaseStack, StorageStack, WorkerStack

6. **ApiStack** (`leadmagnet-api`)
   - Creates API Gateway HTTP API
   - Creates Lambda function for API handlers
   - Configures JWT authentication using Cognito
   - Depends on: AuthStack, DatabaseStack, ComputeStack, StorageStack

## Stack Dependencies

```
DatabaseStack ──┐
                ├──> ComputeStack ──┐
StorageStack ───┤                   ├──> ApiStack
                │                   │
WorkerStack ────┘                   │
                                    │
AuthStack ──────────────────────────┘
```

## Project Structure

```
infrastructure/
├── bin/
│   └── app.ts                    # CDK app entry point
├── lib/
│   ├── stacks/                   # CDK stack definitions
│   │   ├── api-stack.ts          # API Gateway stack
│   │   ├── auth-stack.ts         # Cognito stack
│   │   ├── compute-stack.ts      # Step Functions + Lambda stack
│   │   ├── database-stack.ts     # DynamoDB stack
│   │   ├── storage-stack.ts      # S3 + CloudFront stack
│   │   └── worker-stack.ts       # ECR stack
│   ├── types/                    # TypeScript type definitions
│   │   └── index.ts              # Shared types and interfaces
│   ├── config/                   # Configuration constants
│   │   └── constants.ts          # Centralized configuration constants
│   ├── utils/                    # Helper functions
│   │   ├── dynamodb-helpers.ts   # DynamoDB table creation helpers
│   │   ├── environment-helpers.ts # Environment variable helpers
│   │   └── lambda-helpers.ts     # Lambda function creation helpers
│   ├── monitoring/               # CloudWatch monitoring
│   │   └── alarms.ts             # CloudWatch alarm helpers
│   ├── stepfunctions/            # Step Functions definitions
│   │   ├── job-processor-state-machine.ts  # Step Functions definition
│   │   └── error-handlers.ts     # Reusable error handling patterns
│   └── lambdas/                  # Cognito trigger Lambda functions
│       ├── index.js              # PreSignUp trigger
│       └── postConfirmation.js   # PostConfirmation trigger
├── tests/                        # Test directory
│   └── README.md                 # Test setup documentation
├── dist/                         # Compiled TypeScript output (generated)
├── cdk.json                      # CDK configuration
├── package.json                  # Node.js dependencies
└── tsconfig.json                 # TypeScript configuration
```

## Configuration

All configuration values are centralized in `lib/config/constants.ts`. This includes:

- Secret names (Secrets Manager)
- Table names (DynamoDB)
- Function names (Lambda)
- Stack names (CloudFormation)
- Default values (memory sizes, timeouts, retention periods)
- Resource prefixes

## Prerequisites

- Node.js 18+ and npm
- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed: `npm install -g aws-cdk`
- TypeScript: `npm install -g typescript`

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set environment variables:
   ```bash
   export CDK_DEFAULT_ACCOUNT=<your-aws-account-id>
   export CDK_DEFAULT_REGION=us-east-1  # Optional, defaults to us-east-1
   ```

3. Bootstrap CDK (first time only):
   ```bash
   cdk bootstrap
   ```

## Deployment

### Deploy All Stacks

```bash
npm run deploy
```

Or using CDK directly:

```bash
cdk deploy --all
```

### Deploy Individual Stacks

```bash
cdk deploy leadmagnet-database
cdk deploy leadmagnet-auth
cdk deploy leadmagnet-storage
cdk deploy leadmagnet-worker
cdk deploy leadmagnet-compute
cdk deploy leadmagnet-api
```

**Note:** Deploy stacks in dependency order if deploying individually.

### Synthesize CloudFormation Templates

```bash
npm run synth
```

This generates CloudFormation templates in `cdk.out/` without deploying.

## Development

### Watch Mode

```bash
npm run watch
```

This watches for file changes and recompiles TypeScript automatically.

### Type Checking

```bash
npm run build
```

### View Differences

```bash
cdk diff
```

Shows the difference between deployed stack and current code.

## Monitoring

CloudWatch alarms can be created using helpers in `lib/monitoring/alarms.ts`. These provide:

- Lambda error alarms
- Lambda throttle alarms
- Step Functions failure alarms
- Step Functions timeout alarms

Example usage:

```typescript
import { createLambdaAlarms } from './monitoring/alarms';

const alarms = createLambdaAlarms(this, lambdaFunction, 'my-function');
```

## Best Practices

1. **Use Constants**: Always use constants from `lib/config/constants.ts` instead of hardcoded values
2. **Type Safety**: Use the `TableMap` type and `TableKey` enum for type-safe table access
3. **Error Handling**: Use error handler helpers from `lib/stepfunctions/error-handlers.ts`
4. **Validation**: Helper functions include input validation - check error messages
5. **Documentation**: Add JSDoc comments to public functions and classes

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   - Error: `CDK_DEFAULT_ACCOUNT is required but not set`
   - Solution: Set `CDK_DEFAULT_ACCOUNT` environment variable

2. **Stack Dependencies**
   - Error: Stack not found
   - Solution: Deploy dependent stacks first

3. **Type Errors**
   - Error: Type mismatch in `TableMap`
   - Solution: Use `TableKey` enum values when accessing tables

## Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS CDK TypeScript Reference](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-construct-library.html)
- [CDK Workshop](https://cdkworkshop.com/)

## License

See main project LICENSE file.

