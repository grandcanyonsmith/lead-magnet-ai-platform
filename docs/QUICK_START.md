# Quick Start Guide

> **Last Updated**: 2025-01-27  
> **Status**: Current  
> **Related Docs**: [Deployment Guide](./DEPLOYMENT.md), [Architecture Overview](./ARCHITECTURE.md), [Resources](./RESOURCES.md)

Get up and running quickly with the Lead Magnet AI Platform. This guide provides essential commands and verification steps.

## Prerequisites

Before starting, ensure you have:
- AWS CLI configured with appropriate credentials
- Access to your AWS account
- Platform deployed (see [Deployment Guide](./DEPLOYMENT.md))

## Finding Your Platform URLs

After deployment, retrieve your platform URLs using AWS CLI:

### API Gateway URL
```bash
API_URL=$(aws cloudformation describe-stacks \
  --stack-name leadmagnet-api \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)
echo $API_URL
```

### Frontend/Dashboard URL
```bash
FRONTEND_URL=$(aws cloudformation describe-stacks \
  --stack-name leadmagnet-storage \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionDomainName'].OutputValue" \
  --output text)
echo "https://$FRONTEND_URL/"
```

### Form URLs
Form URLs follow the pattern: `$API_URL/v1/forms/{slug}`

Replace `{slug}` with your form's public slug.

## Finding Your Credentials

### Cognito User Pool Information
```bash
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name leadmagnet-auth \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text)

CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name leadmagnet-auth \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
  --output text)

echo "User Pool ID: $USER_POOL_ID"
echo "Client ID: $CLIENT_ID"
```

### Creating a Test User
```bash
# Create a test user (replace with your values)
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username your-email@example.com \
  --user-attributes Name=email,Value=your-email@example.com \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS
```

⚠️ **Security Note**: Change the temporary password on first login.

## Testing the Platform

### Option 1: Test Form Submission (Web Browser)
1. Get your form URL: `$API_URL/v1/forms/{your-form-slug}`
2. Open the URL in your browser
3. Fill out and submit the form
4. You'll receive a job ID in the response

### Option 2: Test Form Submission (Command Line)
```bash
# Set your API URL (from above)
API_URL="your-api-url-here"
FORM_SLUG="your-form-slug"

# Submit form
curl -X POST "$API_URL/v1/forms/$FORM_SLUG/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "submission_data": {
      "name": "Test User",
      "email": "test@example.com",
      "project": "Test project description"
    }
  }'
```

### Option 3: Run Automated Tests
```bash
# Run end-to-end tests
./scripts/test-e2e.sh
```

## Quick Commands

### Test the API
```bash
# Set your API URL
API_URL="your-api-url-here"
FORM_SLUG="your-form-slug"

# Get form configuration
curl "$API_URL/v1/forms/$FORM_SLUG"

# Submit form
curl -X POST "$API_URL/v1/forms/$FORM_SLUG/submit" \
  -H "Content-Type: application/json" \
  -d '{"submission_data":{"name":"Test","email":"test@test.com","project":"Testing"}}'

# Run E2E tests
./scripts/test-e2e.sh
```

### Check Platform Status
```bash
# View recent jobs
aws dynamodb scan --table-name leadmagnet-jobs --max-items 5

# View API logs
aws logs tail /aws/lambda/leadmagnet-api-handler --follow

# Get Step Functions state machine ARN
STATE_MACHINE_ARN=$(aws cloudformation describe-stacks \
  --stack-name leadmagnet-compute \
  --query "Stacks[0].Outputs[?OutputKey=='StateMachineArn'].OutputValue" \
  --output text)

# Check Step Functions executions
aws stepfunctions list-executions \
  --state-machine-arn $STATE_MACHINE_ARN \
  --max-results 5
```

### Deploy Updates

#### Update API Lambda
```bash
cd backend/api
node build.js
cd bundle
zip -r ../api-bundle.zip .
cd ..

# Get Lambda function name
FUNCTION_NAME=$(aws cloudformation describe-stacks \
  --stack-name leadmagnet-api \
  --query "Stacks[0].Outputs[?OutputKey=='ApiFunctionName'].OutputValue" \
  --output text)

aws lambda update-function-code \
  --function-name $FUNCTION_NAME \
  --zip-file fileb://api-bundle.zip
```

#### Update Worker Docker Image
```bash
cd backend/worker

# Get ECR repository URI
ECR_REPO=$(aws cloudformation describe-stacks \
  --stack-name leadmagnet-worker \
  --query "Stacks[0].Outputs[?OutputKey=='EcrRepositoryUri'].OutputValue" \
  --output text)

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $ECR_REPO

# Build and push
docker build -t $ECR_REPO:latest .
docker push $ECR_REPO:latest
```

#### Update Frontend
```bash
cd frontend

# Get environment variables (set these before building)
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

# Build
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
aws s3 sync out/ s3://$FRONTEND_BUCKET/ --delete \
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
  --paths "/*"
```

## AWS Resource Names

Resource names follow consistent patterns. Find specific values using CloudFormation outputs:

### DynamoDB Tables
All tables follow the pattern: `leadmagnet-{resource-type}`
- `leadmagnet-workflows`
- `leadmagnet-forms`
- `leadmagnet-submissions`
- `leadmagnet-jobs`
- `leadmagnet-artifacts`
- `leadmagnet-templates`
- `leadmagnet-user-settings`

### Lambda Functions
```bash
# Get API Lambda function name
aws cloudformation describe-stacks \
  --stack-name leadmagnet-api \
  --query "Stacks[0].Outputs[?OutputKey=='ApiFunctionName'].OutputValue" \
  --output text
```

### Step Functions
```bash
# Get state machine ARN
aws cloudformation describe-stacks \
  --stack-name leadmagnet-compute \
  --query "Stacks[0].Outputs[?OutputKey=='StateMachineArn'].OutputValue" \
  --output text
```

### S3 & CloudFront
```bash
# Get S3 bucket name
aws cloudformation describe-stacks \
  --stack-name leadmagnet-storage \
  --query "Stacks[0].Outputs[?OutputKey=='ArtifactsBucketName'].OutputValue" \
  --output text

# Get CloudFront distribution ID
aws cloudformation describe-stacks \
  --stack-name leadmagnet-storage \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text
```

For complete resource inventory, see [Resources](./RESOURCES.md).

## Creating Your First Workflow

### Step 1: Create Template
```bash
# Use admin dashboard or API:
POST $API_URL/admin/templates
{
  "template_name": "My Template",
  "html_content": "<!DOCTYPE html><html><body>{{REPORT_CONTENT}}</body></html>",
  "is_published": true
}
```

### Step 2: Create Workflow
```bash
POST $API_URL/admin/workflows
{
  "workflow_name": "My Workflow",
  "ai_instructions": "Generate a detailed report...",
  "ai_model": "gpt-4o",
  "template_id": "tmpl_xxx",
  "rewrite_enabled": false
}
```

### Step 3: Create Form
```bash
POST $API_URL/admin/forms
{
  "workflow_id": "wf_xxx",
  "form_name": "My Form",
  "public_slug": "my-form",
  "form_fields_schema": {
    "fields": [
      {"field_id": "name", "field_type": "text", "label": "Name", "required": true},
      {"field_id": "email", "field_type": "email", "label": "Email", "required": true}
    ]
  }
}
```

### Step 4: Share & Test
Access your form at: `$API_URL/v1/forms/{your-form-slug}`

## Troubleshooting

### Common Issues

**API returns 500:**
```bash
aws logs tail /aws/lambda/leadmagnet-api-handler --since 5m
```

**Form not found:**
```bash
aws dynamodb scan --table-name leadmagnet-forms
```

**Job stuck:**
```bash
# Get execution ARN from Step Functions console or logs
aws stepfunctions describe-execution --execution-arn <arn>
```

For comprehensive troubleshooting, see [Troubleshooting Guide](./TROUBLESHOOTING.md).

## Pro Tips

1. **Monitor costs** - Check AWS Cost Explorer regularly
2. **Watch logs** - CloudWatch shows all activity
3. **Start simple** - Use test workflow before creating complex ones
4. **Backup often** - Export templates and configurations
5. **Iterate fast** - Update AI instructions based on results

## Verification Checklist

Run through this checklist to verify everything:

- [ ] Retrieve platform URLs using CloudFormation outputs
- [ ] Create test user in Cognito
- [ ] Open test form URL in browser
- [ ] Submit test form data
- [ ] Check job was created in DynamoDB
- [ ] Verify Step Functions execution
- [ ] Login to admin dashboard
- [ ] Browse workflows, forms, jobs pages
- [ ] Run E2E test script
- [ ] Check CloudWatch logs

## Next Steps

### Immediate
1. **Test the platform** - Submit test forms
2. **Login to dashboard** - Change password
3. **Create first real workflow** - For your business
4. **Share form URL** - Start collecting leads!

### This Week
1. **Customize branding** - Update colors in settings
2. **Design templates** - Create beautiful HTML templates
3. **Set up monitoring** - Configure CloudWatch alarms
4. **Add custom domain** - Use Route 53 (optional)

### This Month
1. **Production workflows** - Build multiple workflows
2. **Analyze results** - Use analytics dashboard
3. **Optimize costs** - Review AWS billing
4. **Scale up** - Add more forms and templates

## Related Documentation

- [Deployment Guide](./DEPLOYMENT.md) - Complete deployment instructions
- [Architecture Overview](./ARCHITECTURE.md) - System architecture and design
- [Resources](./RESOURCES.md) - AWS resource inventory
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues and solutions
- [Flow Diagram](./FLOW_DIAGRAM.md) - Process flow visualization

---

**Ready to revolutionize your lead generation? Start using the platform now!** 🚀
