# 🚀 Lead Magnet AI - Quick Reference

## 📍 Key URLs

| Resource | URL |
|----------|-----|
| **API** | https://czp5b77azd.execute-api.us-east-1.amazonaws.com |
| **Test Form** | https://czp5b77azd.execute-api.us-east-1.amazonaws.com/v1/forms/test-form |
| **Admin Dashboard** | https://dmydkyj79auy7.cloudfront.net/app/ |
| **CloudFront** | https://dmydkyj79auy7.cloudfront.net |

## 🔐 Login Credentials

```
Email:    test@example.com
Password: TempPass123! (change on first login)
Tenant:   tenant_test_001
```

## 🎯 Quick Commands

### Test the API
```bash
# Get form
curl https://czp5b77azd.execute-api.us-east-1.amazonaws.com/v1/forms/test-form

# Submit form
curl -X POST "https://czp5b77azd.execute-api.us-east-1.amazonaws.com/v1/forms/test-form/submit" \
  -H "Content-Type: application/json" \
  -d '{"submission_data":{"name":"Test","email":"test@test.com","project":"Testing"}}'

# Run E2E tests
./scripts/test-e2e.sh
```

### Check Status
```bash
# View recent jobs
aws dynamodb scan --table-name leadmagnet-jobs --max-items 5

# View API logs
aws logs tail /aws/lambda/leadmagnet-api-handler --follow

# Check Step Functions
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:us-east-1:471112574622:stateMachine:leadmagnet-job-processor \
  --max-results 5
```

### Deploy Updates
```bash
# Update API
cd backend/api && node build.js && cd bundle && zip -r ../api-bundle.zip . && cd .. && \
  aws lambda update-function-code --function-name leadmagnet-api-handler --zip-file fileb://api-bundle.zip

# Update Worker
cd backend/worker && docker build -t 471112574622.dkr.ecr.us-east-1.amazonaws.com/leadmagnet/worker:latest . && \
  docker push 471112574622.dkr.ecr.us-east-1.amazonaws.com/leadmagnet/worker:latest

# Update Frontend
cd frontend && npm run build && \
  aws s3 sync out/ s3://leadmagnet-artifacts-471112574622/app/ --delete && \
  aws cloudfront create-invalidation --distribution-id E1GPKD58HXUDIV --paths "/app/*"
```

## 📋 AWS Resource IDs

### DynamoDB Tables
- leadmagnet-workflows
- leadmagnet-forms  
- leadmagnet-submissions
- leadmagnet-jobs
- leadmagnet-artifacts
- leadmagnet-templates
- leadmagnet-user-settings

### Cognito
- **User Pool:** us-east-1_asu0YOrBD
- **Client ID:** 4lb3j8kqfvfgkvfeb4h4naani5

### Lambda
- **Function:** leadmagnet-api-handler
- **ARN:** arn:aws:lambda:us-east-1:471112574622:function:leadmagnet-api-handler

### Step Functions
- **State Machine:** leadmagnet-job-processor
- **ARN:** arn:aws:states:us-east-1:471112574622:stateMachine:leadmagnet-job-processor

### S3 & CloudFront
- **Bucket:** leadmagnet-artifacts-471112574622
- **Distribution:** E1GPKD58HXUDIV

### ECS
- **Cluster:** leadmagnet-cluster
- **ECR:** 471112574622.dkr.ecr.us-east-1.amazonaws.com/leadmagnet/worker

## 🎨 Create Your First Workflow

### Step 1: Create Template
```bash
# Use admin dashboard or API:
POST /admin/templates
{
  "template_name": "My Template",
  "html_content": "<!DOCTYPE html><html><body>{{REPORT_CONTENT}}</body></html>",
  "is_published": true
}
```

### Step 2: Create Workflow
```bash
POST /admin/workflows
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
POST /admin/forms
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
```
https://czp5b77azd.execute-api.us-east-1.amazonaws.com/v1/forms/my-form
```

## 📖 Documentation Files

- **DEPLOYMENT_REPORT.md** - Detailed deployment info
- **SUCCESS_REPORT.md** - Comprehensive success summary
- **PROJECT_README.md** - Developer guide
- **DEPLOYMENT.md** - Deployment instructions
- **SUMMARY.md** - Build statistics

## 🆘 Troubleshooting

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
aws stepfunctions describe-execution --execution-arn <arn>
```

## 💡 Pro Tips

1. **Monitor costs** - Check AWS Cost Explorer regularly
2. **Watch logs** - CloudWatch shows all activity
3. **Start simple** - Use test workflow before creating complex ones
4. **Backup often** - Export templates and configurations
5. **Iterate fast** - Update AI instructions based on results

---

## ✨ Platform is LIVE and READY! ✨

**Everything is deployed, tested, and working!**

**Next:** Login to the dashboard and create your first custom workflow!

---

*Quick Reference | Lead Magnet AI Platform | v1.0.0*

