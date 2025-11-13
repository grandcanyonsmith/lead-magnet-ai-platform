#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Lead Magnet AI Platform - Deployment Script${NC}"
echo "=================================================="
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI not found. Please install it first.${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js not found. Please install it first.${NC}"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker not found. Please install it first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites met${NC}"
echo ""

# Get AWS Account ID and Region
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-east-1}

echo "AWS Account ID: $AWS_ACCOUNT_ID"
echo "AWS Region: $AWS_REGION"
echo ""

# Deploy infrastructure
echo -e "${YELLOW}Step 1: Deploying CDK infrastructure...${NC}"
cd infrastructure
npm install
npx cdk bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION || true
npx cdk deploy --all --require-approval never
cd ..
echo -e "${GREEN}✓ Infrastructure deployed${NC}"
echo ""

# Get stack outputs
echo -e "${YELLOW}Step 2: Getting stack outputs...${NC}"
API_URL=$(aws cloudformation describe-stacks --stack-name leadmagnet-api --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name leadmagnet-auth --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
CLIENT_ID=$(aws cloudformation describe-stacks --stack-name leadmagnet-auth --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text)
ECR_REPO=$(aws cloudformation describe-stacks --stack-name leadmagnet-worker --query "Stacks[0].Outputs[?OutputKey=='EcrRepositoryUri'].OutputValue" --output text)
ARTIFACTS_BUCKET=$(aws cloudformation describe-stacks --stack-name leadmagnet-storage --query "Stacks[0].Outputs[?OutputKey=='ArtifactsBucketName'].OutputValue" --output text)
DISTRIBUTION_ID=$(aws cloudformation describe-stacks --stack-name leadmagnet-storage --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text)

echo "API URL: $API_URL"
echo "User Pool ID: $USER_POOL_ID"
echo "Client ID: $CLIENT_ID"
echo ""

# Build and deploy worker
echo -e "${YELLOW}Step 3: Building and deploying worker Docker image...${NC}"
cd backend/worker
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO
docker build -t $ECR_REPO:latest .
docker push $ECR_REPO:latest
cd ../..
echo -e "${GREEN}✓ Worker deployed${NC}"
echo ""

# Build and deploy API
echo -e "${YELLOW}Step 4: Building and deploying API Lambda...${NC}"
cd backend/api
npm install
npm run package:lambda
# Use bundled version (should be much smaller)
if [ -f "api-bundle.zip" ]; then
    aws lambda update-function-code --function-name leadmagnet-api-handler --zip-file fileb://api-bundle.zip
else
    echo -e "${RED}Error: api-bundle.zip not found. Build may have failed.${NC}"
    exit 1
fi
cd ../..
echo -e "${GREEN}✓ API deployed${NC}"
echo ""

# Build and deploy frontend
echo -e "${YELLOW}Step 5: Building and deploying frontend...${NC}"
cd frontend
npm install
NODE_ENV=production \
NEXT_PUBLIC_API_URL=$API_URL \
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$USER_POOL_ID \
NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID \
NEXT_PUBLIC_AWS_REGION=$AWS_REGION \
npm run build
# Sync frontend to root, but exclude artifact paths to prevent deletion
aws s3 sync out s3://$ARTIFACTS_BUCKET/ --delete --exclude "*/jobs/*" --exclude "*/images/*" --cache-control max-age=31536000,public
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths '/*'
cd ..
echo -e "${GREEN}✓ Frontend deployed${NC}"
echo ""

# Get CloudFront URL
CF_URL=$(aws cloudformation describe-stacks --stack-name leadmagnet-storage --query "Stacks[0].Outputs[?OutputKey=='DistributionDomainName'].OutputValue" --output text)

echo ""
echo -e "${GREEN}=================================================="
echo "Deployment Complete!"
echo "==================================================${NC}"
echo ""
echo "Admin Dashboard: https://$CF_URL"
echo "API URL: $API_URL"
echo ""
echo "Next steps:"
echo "1. Create your first user in Cognito"
echo "2. Log in to the admin dashboard"
echo "3. Create a workflow and form"
echo ""
echo "To create a user:"
echo "aws cognito-idp admin-create-user \\"
echo "  --user-pool-id $USER_POOL_ID \\"
echo "  --username admin@example.com \\"
echo "  --user-attributes Name=email,Value=admin@example.com Name=name,Value='Admin User' \\"
echo "  --temporary-password 'TempPass123!' \\"
echo "  --message-action SUPPRESS"
echo ""

