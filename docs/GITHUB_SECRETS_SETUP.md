# 🔐 GitHub Secrets Setup Guide

This guide explains how to configure GitHub Secrets for CI/CD deployment.

## Required Secrets

Based on your workflows, you need the following secrets:

### Required for All Workflows
- `AWS_ROLE_ARN` - IAM Role ARN for OIDC authentication (recommended)
  - OR use `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` (alternative)

### Frontend Deployment
- `API_URL` - Your API Gateway URL
- `COGNITO_USER_POOL_ID` - Cognito User Pool ID
- `COGNITO_CLIENT_ID` - Cognito Client ID
- `FRONTEND_BUCKET` - S3 bucket name for frontend assets
- `CLOUDFRONT_DISTRIBUTION_ID` - CloudFront distribution ID

---

## Option 1: OIDC Authentication (Recommended - More Secure)

This is the **recommended** approach as it doesn't require storing long-lived credentials.

### Step 1: Create IAM Role for GitHub Actions

1. **Create an IAM Role** in AWS Console:
   - Go to IAM → Roles → Create Role
   - Select "Web Identity"
   - Choose "GitHub" as the identity provider
   - For GitHub, use: `token.actions.githubusercontent.com`
   - Add your GitHub organization/repository as the audience

2. **Configure Trust Policy**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
         },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
           "StringEquals": {
             "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
           },
           "StringLike": {
             "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_USERNAME/YOUR_REPO_NAME:*"
           }
         }
       }
     ]
   }
   ```

3. **Attach Permissions**:
   - Lambda: `AWSLambda_FullAccess` (or custom policy)
   - DynamoDB: `AmazonDynamoDBFullAccess` (or custom policy)
   - S3: `AmazonS3FullAccess` (or custom policy)
   - CloudFront: `CloudFrontFullAccess` (or custom policy)
   - ECR: `AmazonEC2ContainerRegistryFullAccess` (or custom policy)
   - CDK: `PowerUserAccess` or `AdministratorAccess` (for CDK deployments)

4. **Note the Role ARN** (format: `arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME`)

### Step 2: Set Up GitHub OIDC Provider (One-time setup)

If you haven't set up OIDC in AWS:

```bash
# Get your AWS Account ID
aws sts get-caller-identity --query Account --output text

# Create OIDC provider (replace YOUR_ACCOUNT_ID)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### Step 3: Add GitHub Secret

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add:
   - **Name**: `AWS_ROLE_ARN`
   - **Value**: Your IAM role ARN (e.g., `arn:aws:iam::123456789012:role/github-actions-role`)

---

## Option 2: Access Key Authentication (Simpler but Less Secure)

If you prefer to use access keys instead of OIDC:

### Step 1: Create IAM User

1. Go to IAM → Users → Create User
2. Name: `github-actions-deploy`
3. Attach policies:
   - `AWSLambda_FullAccess`
   - `AmazonDynamoDBFullAccess`
   - `AmazonS3FullAccess`
   - `CloudFrontFullAccess`
   - `AmazonEC2ContainerRegistryFullAccess`
   - `PowerUserAccess` (for CDK)

### Step 2: Create Access Keys

1. Select the user → **Security credentials** tab
2. Click **Create access key**
3. Choose **Application running outside AWS**
4. **Save both**:
   - Access Key ID
   - Secret Access Key (shown only once!)

### Step 3: Update Workflows

You'll need to update your workflows to use access keys instead of OIDC. See `QUICK_SETUP.md` for updated workflow files.

### Step 4: Add GitHub Secrets

Add these secrets to your repository:
- `AWS_ACCESS_KEY_ID` - Your access key ID
- `AWS_SECRET_ACCESS_KEY` - Your secret access key

---

## Additional Secrets for Frontend Deployment

Add these secrets for frontend deployment:

1. **API_URL**
   - Value: `https://czp5b77azd.execute-api.us-east-1.amazonaws.com`
   - Or your API Gateway URL

2. **COGNITO_USER_POOL_ID**
   - Value: `us-east-1_asu0YOrBD`
   - Or your Cognito User Pool ID

3. **COGNITO_CLIENT_ID**
   - Value: `4lb3j8kqfvfgkvfeb4h4naani5`
   - Or your Cognito Client ID

4. **FRONTEND_BUCKET**
   - Value: Your S3 bucket name (e.g., `leadmagnet-artifacts-471112574622`)

5. **CLOUDFRONT_DISTRIBUTION_ID**
   - Value: Your CloudFront distribution ID (e.g., `E1GPKD58HXUDIV`)

---

## Quick Setup Script

If you want to use access keys (Option 2), here's a quick script to get your values:

```bash
# Get your AWS Account ID
echo "AWS Account ID:"
aws sts get-caller-identity --query Account --output text

# Get your S3 bucket name (if you know the pattern)
echo "S3 Bucket (check your infrastructure):"
aws s3 ls | grep leadmagnet

# Get your CloudFront distribution ID
echo "CloudFront Distribution ID:"
aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='leadmagnet'].Id" --output text

# Get your Cognito User Pool ID
echo "Cognito User Pool ID:"
aws cognito-idp list-user-pools --max-results 10 --query "UserPools[?Name=='leadmagnet'].Id" --output text
```

---

## Current Values (From Your Setup)

Based on your existing configuration:

- **AWS Region**: `us-east-1`
- **Cognito User Pool ID**: `us-east-1_asu0YOrBD`
- **Cognito Client ID**: `4lb3j8kqfvfgkvfeb4h4naani5`
- **API URL**: `https://czp5b77azd.execute-api.us-east-1.amazonaws.com`

You'll need to find:
- **AWS Account ID**: Run `aws sts get-caller-identity --query Account --output text`
- **S3 Bucket Name**: Check your infrastructure or S3 console
- **CloudFront Distribution ID**: Check CloudFront console or infrastructure
- **Lambda Function Name**: `leadmagnet-api-handler` (from workflow)

