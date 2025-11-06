# Quick Start Guide

## 🚀 Getting Started

Your complete AI-powered lead magnet generation platform is **LIVE** and **WORKING**!

## 🌐 Platform URLs

### 🔥 Try It Now!

**Test Form (Live & Working):**
```
https://czp5b77azd.execute-api.us-east-1.amazonaws.com/v1/forms/test-form
```
👆 **Click this URL to see your working form!**

**Admin Dashboard:**
```
https://dmydkyj79auy7.cloudfront.net/app/
```

**API Base:**
```
https://czp5b77azd.execute-api.us-east-1.amazonaws.com
```

## 🔐 Login Credentials

```
Email:    test@example.com
Password: TempPass123!
Tenant:   tenant_test_001
```

⚠️ **You'll need to change this password on first login**

## 🧪 Test It Right Now!

### Option 1: Web Browser
1. Open: https://czp5b77azd.execute-api.us-east-1.amazonaws.com/v1/forms/test-form
2. Fill out the form
3. Submit
4. You'll get a job ID back!

### Option 2: Command Line
```bash
curl -X POST "https://czp5b77azd.execute-api.us-east-1.amazonaws.com/v1/forms/test-form/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "submission_data": {
      "name": "Your Name",
      "email": "your@email.com",
      "project": "I need a market research report for my business"
    }
  }'
```

### Option 3: Run Automated Tests
```bash
./scripts/test-e2e.sh
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

## 🎓 How to Use Your Platform

### For End Users (Your Customers)
1. Share public form URL with your audience
2. They fill it out
3. System automatically generates personalized report
4. Report delivered via public URL

### For You (Administrator)
1. **Login** to admin dashboard
2. **Create Workflows** with custom AI instructions
3. **Design Templates** in HTML
4. **Build Forms** and get public URLs
5. **Monitor** submissions and jobs
6. **Analyze** usage with built-in analytics

## 🎉 Verification Checklist

Run through this checklist to verify everything:

- [ ] Open test form URL in browser
- [ ] Submit test form data
- [ ] Check job was created in DynamoDB
- [ ] Verify Step Functions execution
- [ ] Login to admin dashboard
- [ ] Browse workflows, forms, jobs pages
- [ ] Run E2E test script
- [ ] Check CloudWatch logs

**All should work!** ✅

## 💡 Next Steps

### Immediate (Do Today)
1. ✅ **Test the platform** - Submit test forms
2. ✅ **Login to dashboard** - Change password
3. 🔄 **Create first real workflow** - For your business
4. 🔄 **Share form URL** - Start collecting leads!

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

---

**Ready to revolutionize your lead generation? Start using the platform now!** 🚀

