# Lead Magnet AI Platform - Resource Inventory

## AWS Resources Deployed

### Account Information
- **AWS Account ID:** 471112574622
- **Region:** us-east-1
- **Deployment Date:** October 17, 2025

---

## CloudFormation Stacks

| Stack Name | Status | Resources |
|------------|--------|-----------|
| leadmagnet-database | CREATE_COMPLETE | 7 DynamoDB tables |
| leadmagnet-auth | CREATE_COMPLETE | Cognito User Pool |
| leadmagnet-storage | CREATE_COMPLETE | S3, CloudFront |
| leadmagnet-compute | CREATE_COMPLETE | Step Functions, ECS, VPC |
| leadmagnet-api | CREATE_COMPLETE | API Gateway, Lambda |
| leadmagnet-worker | CREATE_COMPLETE | ECS Task, ECR |

---

## DynamoDB Tables

| Table Name | Partition Key | Sort Key | GSIs |
|------------|---------------|----------|------|
| leadmagnet-workflows | workflow_id | - | gsi_tenant_status, gsi_form_id |
| leadmagnet-forms | form_id | - | gsi_tenant_id, gsi_public_slug, gsi_workflow_id |
| leadmagnet-submissions | submission_id | - | gsi_form_created, gsi_tenant_created |
| leadmagnet-jobs | job_id | - | gsi_workflow_status, gsi_tenant_created |
| leadmagnet-artifacts | artifact_id | - | gsi_job_id, gsi_tenant_type |
| leadmagnet-templates | template_id | version | gsi_tenant_id |
| leadmagnet-user-settings | tenant_id | - | - |

---

## Compute Resources

### Lambda Functions
| Function Name | Runtime | Memory | Timeout | Status |
|---------------|---------|--------|---------|--------|
| leadmagnet-api-handler | nodejs20.x | 2048 MB | 30s | Active |

### Step Functions
| State Machine | ARN | Status |
|---------------|-----|--------|
| leadmagnet-job-processor | arn:aws:states:us-east-1:471112574622:stateMachine:leadmagnet-job-processor | Active |

### ECS
| Resource | Name | Status |
|----------|------|--------|
| Cluster | leadmagnet-cluster | Active |
| Task Definition | leadmagnet-worker:1 | Active |

---

## Storage Resources

### S3 Buckets
| Bucket | Purpose | Versioning | Encryption |
|--------|---------|------------|------------|
| leadmagnet-artifacts-471112574622 | Artifacts & Frontend | Enabled | AWS-Managed |

### CloudFront
| Distribution ID | Domain | Status |
|-----------------|--------|--------|
| E1GPKD58HXUDIV | dmydkyj79auy7.cloudfront.net | Deployed |

### ECR
| Repository | URI |
|------------|-----|
| leadmagnet/worker | 471112574622.dkr.ecr.us-east-1.amazonaws.com/leadmagnet/worker |

---

## Security Resources

### Cognito
| Resource | Value |
|----------|-------|
| User Pool ID | us-east-1_asu0YOrBD |
| Client ID | 4lb3j8kqfvfgkvfeb4h4naani5 |
| Domain | leadmagnet-471112574622.auth.us-east-1.amazoncognito.com |

### Secrets Manager
| Secret Name | Purpose |
|-------------|---------|
| leadmagnet/openai-api-key | OpenAI API key for AI generation |

### IAM Roles
- ApiLambdaRole - For API Lambda function
- StateMachineRole - For Step Functions
- TaskRole - For ECS tasks
- TaskExecutionRole - For ECS task execution

---

## Networking

### VPC
| Resource | ID |
|----------|-----|
| VPC | vpc-08d64cbdaee46da3d |
| Public Subnets | 2 subnets across 2 AZs |
| Private Subnets | 2 subnets across 2 AZs |
| NAT Gateway | 1 NAT Gateway |

---

## API Gateway

| Resource | Value |
|----------|-------|
| API ID | czp5b77azd |
| API URL | https://czp5b77azd.execute-api.us-east-1.amazonaws.com |
| Protocol | HTTP API (v2) |

### Routes
- `GET /v1/{proxy+}` - Public routes
- `POST /v1/{proxy+}` - Public routes
- `GET /admin/{proxy+}` - Admin routes (JWT required)
- `POST /admin/{proxy+}` - Admin routes (JWT required)
- `PUT /admin/{proxy+}` - Admin routes (JWT required)
- `PATCH /admin/{proxy+}` - Admin routes (JWT required)
- `DELETE /admin/{proxy+}` - Admin routes (JWT required)

---

## Test Data Created

### Template
- **ID:** tmpl_test001
- **Name:** Test Template
- **Version:** 1

### Workflow
- **ID:** wf_test001
- **Name:** Test Workflow
- **Status:** active

### Form
- **ID:** form_test001
- **Name:** Test Form
- **Slug:** test-form
- **URL:** /v1/forms/test-form

### User
- **Email:** test@example.com
- **Tenant:** tenant_test_001

---

## Monitoring Resources

### CloudWatch Log Groups
- /aws/lambda/leadmagnet-api-handler
- /aws/stepfunctions/leadmagnet-job-processor
- /ecs/leadmagnet-worker

### X-Ray
- Tracing enabled on Lambda and Step Functions

---

## Cost Breakdown

### Provisioned Resources
| Resource | Pricing Model | Est. Cost/Month |
|----------|---------------|-----------------|
| DynamoDB (7 tables) | On-Demand | $5-10 |
| Lambda | Pay-per-invocation | $0-5 (free tier) |
| Step Functions | Pay-per-transition | $0-1 |
| S3 | Pay-per-GB | $1-5 |
| CloudFront | Pay-per-request | $1-5 |
| ECS Fargate | Pay-per-second | $0.10-0.50 per job |
| NAT Gateway | Hourly + data | $30-40 |
| ECR | Pay-per-GB | $0-1 |
| Cognito | Pay-per-MAU | $0-5 |
| **OpenAI API** | **Pay-per-token** | **$10-100** |
| **Total** | | **~$50-200/month** |

---

## File Structure Summary

```
lead-magnent-ai/
├── infrastructure/          (8 files - AWS CDK)
│   ├── bin/app.ts
│   └── lib/*.ts
├── backend/
│   ├── api/                (13 files - TypeScript)
│   └── worker/             (8 files - Python)
├── frontend/               (20+ files - Next.js)
│   └── src/app/
├── .github/workflows/      (4 files - CI/CD)
├── scripts/                (3 files - Helpers)
└── docs/                   (7 markdown files)
```

---

## Access URLs Summary

```bash
# API
export API_URL="https://czp5b77azd.execute-api.us-east-1.amazonaws.com"

# Frontend
export FRONTEND_URL="https://dmydkyj79auy7.cloudfront.net/app/"

# Test Form
export TEST_FORM="$API_URL/v1/forms/test-form"

# CloudFront
export CDN_URL="https://dmydkyj79auy7.cloudfront.net"
```

---

## Management Commands

### View All Stacks
```bash
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE
```

### View All Tables
```bash
aws dynamodb list-tables
```

### View Lambda Functions
```bash
aws lambda list-functions --query 'Functions[?contains(FunctionName, `leadmagnet`)].FunctionName'
```

### View ECS Resources
```bash
aws ecs list-clusters
aws ecs list-task-definitions
```

---

**Last Updated:** October 17, 2025  
**Status:** All resources active and tested ✅
