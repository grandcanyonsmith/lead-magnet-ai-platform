# Lead Magnet Infrastructure

AWS CDK infrastructure code for the Lead Magnet AI Platform.

## Overview

This directory contains the AWS CDK (Cloud Development Kit) code that defines and deploys all AWS resources for the Lead Magnet platform.

## Architecture

The infrastructure is organized into the following stacks:

### Foundation Stacks (No Dependencies)

1. **DatabaseStack** (`leadmagnet-database`)
   - Creates all DynamoDB tables (9 tables total)
   - Includes Global Secondary Indexes (GSIs)

2. **AuthStack** (`leadmagnet-auth`)
   - Creates Cognito User Pool and User Pool Client
   - Handles user authentication and authorization

3. **StorageStack** (`leadmagnet-storage`)
   - Creates S3 bucket for storing artifacts
   - Creates CloudFront distribution for CDN

4. **WorkerStack** (`leadmagnet-worker`)
   - Creates ECR repository for Lambda container images

### Application Stacks (Have Dependencies)

5. **ComputeStack** (`leadmagnet-compute`)
   - Creates Step Functions state machine
   - Creates Lambda function for processing workflow jobs

6. **ApiStack** (`leadmagnet-api`)
   - Creates API Gateway HTTP API
   - Creates Lambda function for API handlers

## Prerequisites

- **Node.js 20+** and npm
- **AWS CLI** configured with appropriate credentials
- **AWS CDK CLI**: `npm install -g aws-cdk`

## Deployment

You can deploy from the repository root using the helper scripts (recommended) or directly via CDK.

### Recommended (Repo Root)

```bash
# Deploy all stacks
./scripts/deployment/deploy.sh

# Destroy all stacks
./scripts/deployment/destroy.sh
```

### Direct (Infrastructure Workspace)

Run from `infrastructure/` directory:

```bash
# Deploy all
npm run deploy

# Deploy individual stack
cdk deploy leadmagnet-database
```

## Configuration

All configuration values are centralized in `lib/config/constants.ts`. This includes:
- Secret names (Secrets Manager)
- Table names (DynamoDB)
- Function names (Lambda)
- Stack names (CloudFormation)

## Monitoring

CloudWatch alarms can be created using helpers in `lib/monitoring/alarms.ts`. These provide:
- Lambda error/throttle alarms
- Step Functions failure/timeout alarms

## Troubleshooting

1. **Missing Environment Variables**: Ensure `CDK_DEFAULT_ACCOUNT` is set if using explicit account deployment.
2. **Stack Dependencies**: Always deploy foundation stacks before application stacks if deploying manually.
3. **Type Errors**: Use `TableKey` enum values when accessing tables in code.
