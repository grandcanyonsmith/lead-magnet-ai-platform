# Lead Magnet AI Platform - Resource Inventory

> **Last Updated**: 2025-12-17  
> **Status**: Current  
> **Related Docs**: [Architecture Overview](./ARCHITECTURE.md), [Deployment Guide](./DEPLOYMENT.md), [Quick Start Guide](./QUICK_START.md)

Complete inventory of AWS resources deployed for the Lead Magnet AI Platform.

---

## Finding Your Resource Values

All resource names follow consistent patterns. Use CloudFormation outputs to find specific values:

```bash
# Get all stack outputs
aws cloudformation describe-stacks --stack-name leadmagnet-{stack-name} \
  --query "Stacks[0].Outputs"

# Get specific output value
aws cloudformation describe-stacks --stack-name leadmagnet-{stack-name} \
  --query "Stacks[0].Outputs[?OutputKey=='{OutputKey}'].OutputValue" \
  --output text
```

## CloudFormation Stacks

| Stack Name | Status | Resources |
|------------|--------|-----------|
| leadmagnet-database | CREATE_COMPLETE | DynamoDB tables (core + billing/ops) |
| leadmagnet-auth | CREATE_COMPLETE | Cognito User Pool |
| leadmagnet-storage | CREATE_COMPLETE | S3, CloudFront |
| leadmagnet-compute | CREATE_COMPLETE | Step Functions, Lambda (job processor) |
| leadmagnet-api | CREATE_COMPLETE | API Gateway, Lambda, WAF |
| leadmagnet-worker | CREATE_COMPLETE | ECR repository |

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
| leadmagnet-notifications | notification_id | - | gsi_tenant_created, gsi_tenant_read |
| leadmagnet-users | user_id | - | gsi_customer_id |
| leadmagnet-customers | customer_id | - | gsi_stripe_customer_id |
| leadmagnet-files | file_id | - | gsi_customer_id |
| leadmagnet-impersonation-logs | log_id | - | - |
| leadmagnet-sessions | session_id | - | - |
| leadmagnet-webhook-logs | log_id | - | - |
| leadmagnet-tracking-events | event_id | - | gsi_job_created, gsi_ip_created |
| leadmagnet-rate-limits | pk | - | - |
| leadmagnet-usage-records | usage_id | - | - |
| leadmagnet-folders | folder_id | - | gsi_tenant_created |

---

## Compute Resources

### Lambda Functions
| Function Name | Runtime | Memory | Timeout | Status |
|---------------|---------|--------|---------|--------|
| leadmagnet-api-handler | nodejs20.x | 2048 MB | 900s | Active |
| leadmagnet-job-processor | container image (Python) | 3008 MB | 15m | Active |

### Step Functions
| State Machine | ARN | Status |
|---------------|-----|--------|
| leadmagnet-job-processor | arn:aws:states:us-east-1:471112574622:stateMachine:leadmagnet-job-processor | Active |

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

### WAFv2 (optional)
- API WAF ARN: `ApiWebAclArn` (CloudFormation output on `leadmagnet-api`)
- CloudFront WAF ARN: `CloudFrontWebAclArn` (CloudFormation output on `leadmagnet-storage`, created only in `us-east-1`)

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
| leadmagnet/stripe-api-key | Stripe API key (billing) |

### IAM Roles
- ApiLambdaRole - For API Lambda function
- JobProcessorLambdaRole - For job processor Lambda function
- StateMachineRole - For Step Functions

---

## Networking

No custom VPC is required for the default deployment. Lambdas run with AWS-managed networking.

If you later attach Lambdas to a VPC (e.g., for private resources), ensure you provision NAT (or VPC endpoints)
so outbound calls (OpenAI/Stripe/webhooks) can still reach the internet.

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
- /aws/lambda/leadmagnet-job-processor
- /aws/stepfunctions/leadmagnet-job-processor

### X-Ray
- Tracing enabled on Lambda and Step Functions

---

## Cost Breakdown

### Provisioned Resources
| Resource | Pricing Model | Est. Cost/Month |
|----------|---------------|-----------------|
| DynamoDB (multiple tables) | On-Demand | $5-15 |
| Lambda | Pay-per-invocation | $0-5 (free tier) |
| Step Functions | Pay-per-transition | $0-1 |
| S3 | Pay-per-GB | $1-5 |
| CloudFront | Pay-per-request | $1-5 |
| WAFv2 | Pay-per-rule/request | $1-10 |
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

Retrieve your URLs using CloudFormation outputs:

```bash
# API URL
export API_URL=$(aws cloudformation describe-stacks \
  --stack-name leadmagnet-api \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)

# Frontend URL
export FRONTEND_URL=$(aws cloudformation describe-stacks \
  --stack-name leadmagnet-storage \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionDomainName'].OutputValue" \
  --output text)
export FRONTEND_URL="https://$FRONTEND_URL/"

# Test Form (replace with your form slug)
export TEST_FORM="$API_URL/v1/forms/{your-form-slug}"
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

### View ECR Repositories
```bash
aws ecr describe-repositories --query 'repositories[?contains(repositoryName, `leadmagnet`)].repositoryName'
```

---

## Related Documentation

- [Architecture Overview](./ARCHITECTURE.md) - System architecture and design
- [Deployment Guide](./DEPLOYMENT.md) - Deployment instructions
- [Quick Start Guide](./QUICK_START.md) - Quick setup and testing
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues and solutions
- [Flow Diagram](./FLOW_DIAGRAM.md) - Process flow visualization

---

**Last Updated:** 2025-12-17  
**Status:** Current - Use CloudFormation outputs to find specific resource values
