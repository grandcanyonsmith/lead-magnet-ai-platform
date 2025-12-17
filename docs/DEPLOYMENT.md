# Lead Magnet AI Platform - Deployment Guide

> **Last Updated**: 2025-12-17  
> **Status**: Current  
> **Related Docs**: [Architecture Overview](./ARCHITECTURE.md), [Quick Start Guide](./QUICK_START.md), [Resources](./RESOURCES.md), [Troubleshooting Guide](./TROUBLESHOOTING.md)

This guide covers the complete deployment process for the Lead Magnet AI Platform.

## Prerequisites

### Required Tools
- AWS CLI v2 (configured with admin credentials)
- Node.js 20.x or later
- Docker Desktop (for worker image)
- Python 3.11+ (for local testing)
- Git

### AWS Account Requirements
- AWS Account with admin access
- AWS Region: us-east-1 (or modify in configs)
- Estimated costs: $50-200/month depending on usage

## Quick Start

### 1. Clone and Install Dependencies

```bash
# Clone repository
git clone <your-repo-url>
cd lead-magnent-ai

# Install all dependencies
npm run install:all
```

### 2. Configure Environment Variables

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your AWS account details
# You'll need to fill in:
# - AWS_ACCOUNT_ID
# - AWS_REGION
# - OPENAI_API_KEY (will be stored in Secrets Manager)
```

### 3. Store Secrets in AWS Secrets Manager

```bash
# Store OpenAI API Key
aws secretsmanager create-secret \
  --name leadmagnet/openai-api-key \
  --description "OpenAI API Key for AI generation" \
  --secret-string "sk-proj-YOUR-API-KEY-HERE"
```

### 4. Deploy Infrastructure with CDK

```bash
# Navigate to infrastructure directory
cd infrastructure

# Install dependencies
npm install

# Bootstrap CDK (first time only)
npx cdk bootstrap

# Deploy all stacks
npx cdk deploy --all --require-approval never
```

This will deploy:
- DynamoDB tables (core + billing/ops)
- Cognito User Pool
- S3 buckets + CloudFront
- API Gateway + Lambda
- Step Functions state machine (orchestration)
- ECR repository (Lambda container images)

**Expected Time:** 10-15 minutes

### 5. Build and Deploy Worker Docker Image

```bash
# Navigate to worker directory
cd backend/worker

# Get ECR repository URI (from CDK output)
ECR_REPO=$(aws cloudformation describe-stacks \
  --stack-name leadmagnet-worker \
  --query "Stacks[0].Outputs[?OutputKey=='EcrRepositoryUri'].OutputValue" \
  --output text)

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $ECR_REPO

# Build and push image
docker build -t $ECR_REPO:latest .
docker push $ECR_REPO:latest

# IMPORTANT: Updating the image tag in ECR does NOT automatically update the Lambda container.
# Update the job processor Lambda to use the new image.
JOB_PROCESSOR_LAMBDA_ARN=$(aws cloudformation describe-stacks \
  --stack-name leadmagnet-compute \
  --query "Stacks[0].Outputs[?OutputKey=='JobProcessorLambdaArn'].OutputValue" \
  --output text)

aws lambda update-function-code \
  --function-name "$JOB_PROCESSOR_LAMBDA_ARN" \
  --image-uri "$ECR_REPO:latest" \
  --region us-east-1
```

### 6. Build and Deploy API Lambda

```bash
cd backend/api

# Install dependencies
npm install

# Package Lambda bundle
npm run package:lambda

# Update Lambda function code
aws lambda update-function-code \
  --function-name leadmagnet-api-handler \
  --zip-file fileb://api-bundle.zip \
  --region us-east-1
```

### 7. Build and Deploy Frontend

```bash
cd frontend

# Install dependencies
npm install

# Get outputs from CDK
API_URL=$(aws cloudformation describe-stacks \
  --stack-name leadmagnet-api \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)

USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name leadmagnet-auth \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text)

CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name leadmagnet-auth \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
  --output text)

# Build with environment variables
NEXT_PUBLIC_API_URL=$API_URL \
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$USER_POOL_ID \
NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID \
NEXT_PUBLIC_AWS_REGION=us-east-1 \
npm run build

# Deploy to S3
FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name leadmagnet-storage \
  --query "Stacks[0].Outputs[?OutputKey=='ArtifactsBucketName'].OutputValue" \
  --output text)

# 1) Upload immutable build assets with long cache
aws s3 sync out/_next s3://$FRONTEND_BUCKET/_next --delete \
  --cache-control "public,max-age=31536000,immutable"

# 2) Upload HTML + route payloads with no-cache (prevents stale app shell in browsers)
# Also exclude artifact prefixes so `--delete` doesn't wipe job outputs.
aws s3 sync out s3://$FRONTEND_BUCKET/ --delete \
  --exclude "_next/*" \
  --exclude "*/jobs/*" \
  --exclude "*/images/*" \
  --cache-control "no-cache, no-store, must-revalidate"

# Invalidate CloudFront
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name leadmagnet-storage \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text)

aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths '/*'
```

### 8. Create First User

```bash
# Option 1: Use AWS Console
# Navigate to Cognito User Pools > leadmagnet-users > Create user

# Option 2: Use AWS CLI
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com Name=name,Value="Admin User" \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS
```

## CI/CD Setup with GitHub Actions

### 1. Configure GitHub Secrets

In your GitHub repository, go to Settings > Secrets and add:

```
AWS_ROLE_ARN=arn:aws:iam::ACCOUNT_ID:role/GitHubActionsRole
API_URL=<your-api-gateway-url>
COGNITO_USER_POOL_ID=<your-user-pool-id>
COGNITO_CLIENT_ID=<your-client-id>
FRONTEND_BUCKET=<your-s3-bucket-name>
CLOUDFRONT_DISTRIBUTION_ID=<your-cloudfront-id>
```

### 2. Create IAM Role for GitHub Actions

```bash
# Create trust policy
cat > github-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_USERNAME/lead-magnent-ai:*"
        }
      }
    }
  ]
}
EOF

# Create role
aws iam create-role \
  --role-name GitHubActionsRole \
  --assume-role-policy-document file://github-trust-policy.json

# Attach policies
aws iam attach-role-policy \
  --role-name GitHubActionsRole \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

### 3. Push to Main Branch

```bash
git add .
git commit -m "Initial deployment"
git push origin main
```

GitHub Actions will automatically deploy all components.

## Verification

### 1. Check Infrastructure

```bash
# Verify DynamoDB tables
aws dynamodb list-tables

# Verify Lambda functions
aws lambda list-functions
```

### 2. Test API Endpoints

```bash
# Get API URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name leadmagnet-api \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)

# Test public endpoint (should return 404 - no form yet)
curl $API_URL/v1/forms/test-slug
```

### 3. Access Frontend

Get CloudFront URL:
```bash
aws cloudformation describe-stacks \
  --stack-name leadmagnet-storage \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionDomainName'].OutputValue" \
  --output text
```

Open the URL in your browser and log in with the created user.

## Post-Deployment Tasks

### 1. Create Your First Workflow

1. Log in to the admin dashboard
2. Navigate to Workflows
3. Click "Create Workflow"
4. Fill in:
   - Workflow Name
   - AI Instructions
   - Select Template
5. Save

### 2. Create a Form

1. Navigate to Forms
2. Click "Create Form"
3. Select the workflow
4. Define form fields
5. Set public slug
6. Save

### 3. Test the Complete Flow

1. Get the form public URL: `https://your-domain.com/v1/forms/{slug}`
2. Submit the form with test data
3. Check Jobs page to see processing status
4. View the generated report

## Monitoring

### CloudWatch Logs

```bash
# API Lambda logs
aws logs tail /aws/lambda/leadmagnet-api-handler --follow

# Worker logs
aws logs tail /aws/lambda/leadmagnet-job-processor --follow

# Step Functions logs
aws logs tail /aws/stepfunctions/leadmagnet-job-processor --follow
```

### CloudWatch Metrics

Navigate to CloudWatch Console:
- Lambda metrics: Invocations, Duration, Errors
- DynamoDB metrics: Read/Write capacity, Throttles
- WAF metrics: blocked requests, rate-based rules

## Troubleshooting

### Common Issues

**Issue: CDK Deploy Fails**
```bash
# Clear CDK cache
rm -rf infrastructure/cdk.out
npx cdk synth
```

**Issue: Lambda Function Timeout**
```bash
# Increase timeout
aws lambda update-function-configuration \
  --function-name leadmagnet-api-handler \
  --timeout 60
```

**Issue: Job Processor Lambda Fails**
```bash
# Check job processor logs
aws logs tail /aws/lambda/leadmagnet-job-processor --follow
```

**Issue: Frontend Not Loading**
```bash
# Check CloudFront distribution status
aws cloudfront get-distribution \
  --id $DISTRIBUTION_ID
```

## Cleanup

To remove all resources:

```bash
# Delete CDK stacks
cd infrastructure
npx cdk destroy --all

# Delete ECR images
aws ecr delete-repository \
  --repository-name leadmagnet/worker \
  --force

# Delete S3 buckets (if not empty)
aws s3 rm s3://leadmagnet-artifacts-$(aws sts get-caller-identity --query Account --output text) --recursive
aws s3 rb s3://leadmagnet-artifacts-$(aws sts get-caller-identity --query Account --output text)
```

## Support

For issues or questions:
1. Check logs in CloudWatch
2. Review this documentation
3. Open an issue in the GitHub repository

## Deployment Report

### ✅ Deployment Complete!

**Date:** October 17, 2025  
**AWS Account:** 471112574622  
**Region:** us-east-1

### Infrastructure Deployed

#### 1. **Database (DynamoDB)** ✅
- `leadmagnet-workflows` - Workflow configurations
- `leadmagnet-forms` - Public forms
- `leadmagnet-submissions` - Form submissions
- `leadmagnet-jobs` - Job processing status
- `leadmagnet-artifacts` - Generated artifacts
- `leadmagnet-templates` - HTML templates
- `leadmagnet-user-settings` - User preferences
- (plus additional billing/ops tables: notifications, users/customers, sessions, tracking, rate limits, etc.)

**Status:** Tables created with GSIs configured

#### 2. **Authentication (Cognito)** ✅
- User Pool ID: `us-east-1_asu0YOrBD`
- Client ID: `4lb3j8kqfvfgkvfeb4h4naani5`
- Domain: `leadmagnet-471112574622.auth.us-east-1.amazoncognito.com`

**Status:** User pool active, test user created

#### 3. **Storage (S3 + CloudFront)** ✅
- S3 Bucket: `leadmagnet-artifacts-471112574622`
- CloudFront Distribution: `E1GPKD58HXUDIV`
- CloudFront Domain: `dmydkyj79auy7.cloudfront.net`

**Status:** Bucket created, CloudFront distribution deployed

#### 4. **Compute (Step Functions + Lambda)** ✅
- State Machine: `leadmagnet-job-processor`
- State Machine ARN: `arn:aws:states:us-east-1:471112574622:stateMachine:leadmagnet-job-processor`
- Job Processor Lambda: `leadmagnet-job-processor` (container image)

**Status:** State machine active, job processor Lambda deployed

#### 5. **API (API Gateway + Lambda)** ✅
- API URL: `https://czp5b77azd.execute-api.us-east-1.amazonaws.com`
- Lambda Function: `leadmagnet-api-handler`
- Function ARN: `arn:aws:lambda:us-east-1:471112574622:function:leadmagnet-api-handler`

**Status:** API Gateway deployed, Lambda function active and tested

#### 6. **Worker (ECR + Lambda container image)** ✅
- ECR Repository: `leadmagnet/worker`
- ECR URI: `471112574622.dkr.ecr.us-east-1.amazonaws.com/leadmagnet/worker`
- Used by: Job processor Lambda (container image)

**Status:** Docker image built and pushed to ECR, Lambda updated to new image

#### 7. **Secrets Manager** ✅
- OpenAI API Key: `leadmagnet/openai-api-key`

**Status:** Secret created and accessible

#### 8. **Frontend (Next.js Static Site)** ✅
- Deployment Location: `s3://leadmagnet-artifacts-471112574622/`
- CloudFront URL: `https://dmydkyj79auy7.cloudfront.net/`

**Status:** Built and deployed to S3

### 🧪 Test Results

#### End-to-End Testing Completed ✅

All tests passed successfully:

| Test | Status | Details |
|------|--------|---------|
| **API Gateway Accessible** | ✅ PASS | API responding on all endpoints |
| **Form Retrieval** | ✅ PASS | GET `/v1/forms/{slug}` working |
| **Form Submission** | ✅ PASS | POST `/v1/forms/{slug}/submit` working |
| **Job Creation** | ✅ PASS | Jobs created in DynamoDB |
| **Step Functions** | ✅ PASS | State machine executions successful |
| **DynamoDB Tables** | ✅ PASS | Tables accessible |
| **Worker Image** | ✅ PASS | Docker image in ECR |
| **Frontend Build** | ✅ PASS | Static site generated |

### 🔑 Access Information

**API Base URL:** `https://czp5b77azd.execute-api.us-east-1.amazonaws.com`

**Frontend URL:** `https://dmydkyj79auy7.cloudfront.net/`
 

**Test User:**
- Email: `test@example.com`
- Password: `TempPass123!` (temporary - must be changed on first login)
- Tenant ID: `tenant_test_001`

### 💰 Cost Estimate

Based on current deployment:

| Resource | Monthly Cost (Estimate) |
|----------|------------------------|
| DynamoDB (multiple tables, on-demand) | $5-15 |
| Lambda (API handler) | $0-5 (free tier) |
| S3 (artifacts storage) | $1-5 |
| CloudFront | $1-5 |
| WAFv2 | $1-10 |
| Step Functions | $0-1 |
| Cognito | $0-5 |
| **OpenAI API** | **$10-100 (varies)** |
| **Total** | **~$20-150/month** |

*Note: Actual costs depend on usage volume*

### 🛠️ Maintenance Tasks

**Weekly:**
- Review CloudWatch logs for errors
- Check job success rates in analytics
- Monitor API response times

**Monthly:**
- Review cost usage in AWS Cost Explorer
- Update dependencies (npm, pip)
- Review and rotate secrets if needed
- Check S3 storage usage

**As Needed:**
- Increase job processor Lambda memory/timeout if processing is slow
- Adjust DynamoDB capacity if throttling occurs
- Update Lambda memory if timeouts occur

### 🔒 Security Checklist

- ✅ Multi-tenant isolation implemented
- ✅ JWT authentication configured
- ✅ Secrets stored in Secrets Manager
- ✅ Encrypted data at rest (S3, DynamoDB)
- ✅ HTTPS/TLS everywhere
- ✅ IAM least privilege configured
- ✅ CloudFront with secure headers
- ✅ WAF rules (API; optional CloudFront WAF in us-east-1)
- ✅ Rate limiting (WAF + DynamoDB-backed per-IP/per-form submit limits)
- ⏳ Custom domain with SSL (recommended)

## Next Steps

- Configure custom domain with Route 53
- Set up monitoring alerts
- Configure backup policies for DynamoDB
- Tune WAF rate limits based on real traffic
- Add custom AI models
- Integrate with external services

## Related Documentation

- [Architecture Overview](./ARCHITECTURE.md) - System architecture and design
- [Quick Start Guide](./QUICK_START.md) - Quick setup and testing
- [Resources](./RESOURCES.md) - AWS resource inventory and management
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common deployment issues
- [Flow Diagram](./FLOW_DIAGRAM.md) - Process flow visualization
- [Changelog](./CHANGELOG.md) - Recent changes and updates

---

