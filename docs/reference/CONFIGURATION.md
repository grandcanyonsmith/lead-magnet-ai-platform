# ⚙️ Configuration Reference

> **Last Updated**: 2026-01-01  
> **Status**: Current  
> **Related Docs**: [Local Development](../../docs/guides/LOCAL_DEVELOPMENT.md), [Deployment](../../docs/guides/DEPLOYMENT.md)

This document outlines the environment variables and configuration settings for the Lead Magnet AI Platform.

## 🌍 Global Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `AWS_REGION` | AWS Region for resources | `us-east-1` | Yes |
| `STAGE` | Deployment stage (dev, prod) | `dev` | Yes |

## 🖥️ Frontend (`frontend/.env.local`)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | URL of the Backend API | `http://localhost:3001` |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | AWS Cognito User Pool ID | `us-east-1_xxxxxx` |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | AWS Cognito Client ID | `xxxxxx` |

## 🔌 Backend API (`backend/api`)

| Variable | Description | Default |
|----------|-------------|---------|
| `WORKFLOWS_TABLE` | DynamoDB table for workflows | `leadmagnet-workflows` |
| `JOBS_TABLE` | DynamoDB table for jobs | `leadmagnet-jobs` |
| `ACCOUNTS_TABLE` | DynamoDB table for accounts | `leadmagnet-accounts` |
| `BODY_LIMIT` | Max request body size | `20mb` |

## 👷 Worker (`backend/worker`)

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | API Key for OpenAI | - |
| `ANTHROPIC_API_KEY` | API Key for Anthropic | - |
| `REPLICATE_API_KEY` | API Key for Replicate | - |

## 🏗️ Infrastructure (`infrastructure`)

See `infrastructure/cdk.json` for CDK context variables.
