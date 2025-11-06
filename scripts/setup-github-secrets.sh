#!/bin/bash

# Setup GitHub Secrets for CI/CD
# This script creates IAM user, access keys, and sets GitHub secrets automatically

set -e

echo "🔐 Setting up GitHub Secrets for CI/CD"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) is not installed${NC}"
    echo "Install it: brew install gh"
    echo "Then authenticate: gh auth login"
    exit 1
fi

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed${NC}"
    exit 1
fi

# Check if authenticated with GitHub
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not authenticated with GitHub${NC}"
    echo "Run: gh auth login"
    exit 1
fi

# Get current AWS account ID
echo "📋 Getting AWS Account ID..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓${NC} Account ID: $ACCOUNT_ID"
echo ""

# IAM User name
IAM_USER_NAME="github-actions-deploy"

# Check if user already exists
if aws iam get-user --user-name "$IAM_USER_NAME" &> /dev/null; then
    echo -e "${YELLOW}⚠️  IAM user '$IAM_USER_NAME' already exists${NC}"
    read -p "Do you want to create new access keys? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping IAM user creation..."
        CREATE_NEW_KEYS=true
    else
        CREATE_NEW_KEYS=true
    fi
else
    CREATE_NEW_KEYS=false
fi

# Create IAM user if it doesn't exist
if [ "$CREATE_NEW_KEYS" = false ]; then
    echo "👤 Creating IAM user: $IAM_USER_NAME..."
    aws iam create-user --user-name "$IAM_USER_NAME" > /dev/null
    echo -e "${GREEN}✓${NC} IAM user created"
    
    echo "📎 Attaching policies..."
    aws iam attach-user-policy --user-name "$IAM_USER_NAME" --policy-arn arn:aws:iam::aws:policy/AWSLambda_FullAccess
    aws iam attach-user-policy --user-name "$IAM_USER_NAME" --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
    aws iam attach-user-policy --user-name "$IAM_USER_NAME" --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
    aws iam attach-user-policy --user-name "$IAM_USER_NAME" --policy-arn arn:aws:iam::aws:policy/CloudFrontFullAccess
    aws iam attach-user-policy --user-name "$IAM_USER_NAME" --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess
    aws iam attach-user-policy --user-name "$IAM_USER_NAME" --policy-arn arn:aws:iam::aws:policy/PowerUserAccess
    echo -e "${GREEN}✓${NC} Policies attached"
fi

# Create access keys
echo "🔑 Creating access keys..."
if [ "$CREATE_NEW_KEYS" = true ]; then
    # Delete old access keys first
    OLD_KEYS=$(aws iam list-access-keys --user-name "$IAM_USER_NAME" --query 'AccessKeyMetadata[].AccessKeyId' --output text)
    for key in $OLD_KEYS; do
        echo "  Deleting old access key: $key"
        aws iam delete-access-key --user-name "$IAM_USER_NAME" --access-key-id "$key" 2>/dev/null || true
    done
fi

ACCESS_KEY_OUTPUT=$(aws iam create-access-key --user-name "$IAM_USER_NAME")
ACCESS_KEY_ID=$(echo "$ACCESS_KEY_OUTPUT" | jq -r '.AccessKey.AccessKeyId')
SECRET_ACCESS_KEY=$(echo "$ACCESS_KEY_OUTPUT" | jq -r '.AccessKey.SecretAccessKey')

echo -e "${GREEN}✓${NC} Access keys created"
echo -e "${YELLOW}⚠️  Save these credentials securely!${NC}"
echo "  Access Key ID: $ACCESS_KEY_ID"
echo "  Secret Access Key: $SECRET_ACCESS_KEY"
echo ""

# Get resource values
echo "🔍 Getting AWS resource values..."

# Get S3 bucket
echo "  Finding S3 bucket..."
S3_BUCKET=$(aws s3 ls | grep -i leadmagnet | awk '{print $3}' | head -1)
if [ -z "$S3_BUCKET" ]; then
    echo -e "${YELLOW}⚠️  S3 bucket not found. You'll need to set FRONTEND_BUCKET manually${NC}"
    read -p "Enter S3 bucket name (or press Enter to skip): " S3_BUCKET
else
    echo -e "${GREEN}✓${NC} Found S3 bucket: $S3_BUCKET"
fi

# Get CloudFront Distribution ID
echo "  Finding CloudFront distribution..."
CF_DIST_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?contains(Comment, 'leadmagnet') || contains(Origins.Items[0].DomainName, 'leadmagnet')].Id" --output text | head -1)
if [ -z "$CF_DIST_ID" ]; then
    echo -e "${YELLOW}⚠️  CloudFront distribution not found. You'll need to set CLOUDFRONT_DISTRIBUTION_ID manually${NC}"
    read -p "Enter CloudFront Distribution ID (or press Enter to skip): " CF_DIST_ID
else
    echo -e "${GREEN}✓${NC} Found CloudFront distribution: $CF_DIST_ID"
fi

# Get repository name
REPO_NAME=$(gh repo view --json name -q .name)
REPO_OWNER=$(gh repo view --json owner -q .owner.login)
echo -e "${GREEN}✓${NC} Repository: $REPO_OWNER/$REPO_NAME"
echo ""

# Set GitHub secrets
echo "🔐 Setting GitHub secrets..."
echo ""

# AWS Credentials
echo "  Setting AWS_ACCESS_KEY_ID..."
gh secret set AWS_ACCESS_KEY_ID --body "$ACCESS_KEY_ID" --repo "$REPO_OWNER/$REPO_NAME"
echo -e "${GREEN}✓${NC} AWS_ACCESS_KEY_ID set"

echo "  Setting AWS_SECRET_ACCESS_KEY..."
gh secret set AWS_SECRET_ACCESS_KEY --body "$SECRET_ACCESS_KEY" --repo "$REPO_OWNER/$REPO_NAME"
echo -e "${GREEN}✓${NC} AWS_SECRET_ACCESS_KEY set"

# API URL
API_URL="https://czp5b77azd.execute-api.us-east-1.amazonaws.com"
echo "  Setting API_URL..."
gh secret set API_URL --body "$API_URL" --repo "$REPO_OWNER/$REPO_NAME"
echo -e "${GREEN}✓${NC} API_URL set"

# Cognito
COGNITO_USER_POOL_ID="us-east-1_asu0YOrBD"
COGNITO_CLIENT_ID="4lb3j8kqfvfgkvfeb4h4naani5"

echo "  Setting COGNITO_USER_POOL_ID..."
gh secret set COGNITO_USER_POOL_ID --body "$COGNITO_USER_POOL_ID" --repo "$REPO_OWNER/$REPO_NAME"
echo -e "${GREEN}✓${NC} COGNITO_USER_POOL_ID set"

echo "  Setting COGNITO_CLIENT_ID..."
gh secret set COGNITO_CLIENT_ID --body "$COGNITO_CLIENT_ID" --repo "$REPO_OWNER/$REPO_NAME"
echo -e "${GREEN}✓${NC} COGNITO_CLIENT_ID set"

# S3 Bucket
if [ -n "$S3_BUCKET" ]; then
    echo "  Setting FRONTEND_BUCKET..."
    gh secret set FRONTEND_BUCKET --body "$S3_BUCKET" --repo "$REPO_OWNER/$REPO_NAME"
    echo -e "${GREEN}✓${NC} FRONTEND_BUCKET set"
fi

# CloudFront Distribution ID
if [ -n "$CF_DIST_ID" ]; then
    echo "  Setting CLOUDFRONT_DISTRIBUTION_ID..."
    gh secret set CLOUDFRONT_DISTRIBUTION_ID --body "$CF_DIST_ID" --repo "$REPO_OWNER/$REPO_NAME"
    echo -e "${GREEN}✓${NC} CLOUDFRONT_DISTRIBUTION_ID set"
fi

echo ""
echo -e "${GREEN}✅ All secrets have been set successfully!${NC}"
echo ""
echo "📋 Summary:"
echo "  - IAM User: $IAM_USER_NAME"
echo "  - Access Key ID: $ACCESS_KEY_ID"
echo "  - Repository: $REPO_OWNER/$REPO_NAME"
echo ""
echo "🧪 Test your workflows:"
echo "  gh workflow run api-deploy.yml"
echo ""

