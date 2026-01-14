#!/bin/bash
set -e

# Source shared utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$(dirname "$SCRIPT_DIR")/lib/shell_common.sh"

show_header "Lead Magnet AI Platform - Deployment Script" "Deploying infrastructure, worker, API, and frontend"

# Check prerequisites
print_info "Checking prerequisites..."
check_prerequisites aws node docker || exit 1
print_success "All prerequisites met"
echo ""

# Get AWS Account ID and Region
AWS_ACCOUNT_ID=$(get_aws_account_id)
AWS_REGION=$(get_aws_region)

echo "AWS Account ID: $AWS_ACCOUNT_ID"
echo "AWS Region: $AWS_REGION"
echo ""

# Deploy infrastructure (foundation stacks first)
print_subsection "Step 1: Deploying CDK infrastructure (foundation stacks)"
cd infrastructure
npm install
npx cdk bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION || true

# IMPORTANT:
# - The Compute stack deploys Lambda container functions using an ECR image tag (`latest`).
# - On a fresh account/region, the image won't exist yet.
# - Deploy foundation stacks first to create the ECR repo (and other deps),
#   then push the worker image, then deploy the application stacks.
npx cdk deploy \
  leadmagnet-database \
  leadmagnet-auth \
  leadmagnet-storage \
  leadmagnet-worker \
  leadmagnet-shell-executor \
  --require-approval never
cd ..
print_success "Foundation infrastructure deployed"
echo ""

# Get stack outputs (foundation)
print_subsection "Step 2: Getting foundation stack outputs"
USER_POOL_ID=$(get_stack_output "leadmagnet-auth" "UserPoolId" "$AWS_REGION")
CLIENT_ID=$(get_stack_output "leadmagnet-auth" "UserPoolClientId" "$AWS_REGION")
ECR_REPO=$(get_stack_output "leadmagnet-worker" "EcrRepositoryUri" "$AWS_REGION")
ARTIFACTS_BUCKET=$(get_stack_output "leadmagnet-storage" "ArtifactsBucketName" "$AWS_REGION")
DISTRIBUTION_ID=$(get_stack_output "leadmagnet-storage" "DistributionId" "$AWS_REGION")

if [ -z "$ECR_REPO" ] || [ "$ECR_REPO" = "None" ]; then
    print_error "ECR repository URI not found (leadmagnet-worker:EcrRepositoryUri). Foundation deploy may have failed."
    exit 1
fi

echo "User Pool ID: $USER_POOL_ID"
echo "Client ID: $CLIENT_ID"
echo "ECR Repo: $ECR_REPO"
echo ""

# Build and deploy worker
print_subsection "Step 3: Building and deploying worker Docker image"
cd backend/worker

# docker login expects the registry host, not the full repository URI
ECR_REGISTRY=$(echo "$ECR_REPO" | awk -F'/' '{print $1}')
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin "$ECR_REGISTRY"

docker build --platform linux/amd64 --provenance=false -t $ECR_REPO:latest .
docker push $ECR_REPO:latest

cd ../..
print_success "Worker deployed"
echo ""

# Deploy application stacks now that the worker image exists
print_subsection "Step 4: Deploying CDK application stacks (compute + API + dashboard)"
cd infrastructure
npx cdk deploy \
  leadmagnet-compute \
  leadmagnet-api \
  leadmagnet-dashboard \
  --require-approval never
cd ..
print_success "Application stacks deployed"
echo ""

# Get stack outputs (application stacks)
print_subsection "Step 5: Getting application stack outputs"
API_URL=$(get_stack_output "leadmagnet-api" "ApiUrl" "$AWS_REGION")
JOB_PROCESSOR_LAMBDA_ARN=$(get_stack_output "leadmagnet-compute" "JobProcessorLambdaArn" "$AWS_REGION")
CUA_WORKER_LAMBDA_ARN=$(get_stack_output "leadmagnet-compute" "CuaWorkerLambdaArn" "$AWS_REGION")
SHELL_WORKER_LAMBDA_ARN=$(get_stack_output "leadmagnet-compute" "ShellWorkerLambdaArn" "$AWS_REGION")

echo "API URL: $API_URL"
echo ""

# IMPORTANT: Lambda container images do NOT auto-refresh when a tag is updated in ECR.
# Update all worker Lambdas to use the latest pushed image.
print_subsection "Step 6: Updating worker Lambdas to use latest container image"
for FN in "$JOB_PROCESSOR_LAMBDA_ARN" "$CUA_WORKER_LAMBDA_ARN" "$SHELL_WORKER_LAMBDA_ARN"; do
  if [ -n "$FN" ] && [ "$FN" != "None" ]; then
    aws lambda update-function-code \
      --function-name "$FN" \
      --image-uri "$ECR_REPO:latest" \
      --region "$AWS_REGION"
  else
    print_warning "Skipping Lambda update (missing ARN)."
  fi
done
print_success "Worker Lambdas updated"
echo ""

# Build and deploy API
print_subsection "Step 7: Building and deploying API Lambda"
cd backend/api
npm install
npm run package:lambda
# Use bundled version (should be much smaller)
if [ -f "api-bundle.zip" ]; then
    aws lambda update-function-code --function-name leadmagnet-api-handler --zip-file fileb://api-bundle.zip --region "$AWS_REGION"
else
    print_error "api-bundle.zip not found. Build may have failed."
    exit 1
fi
cd ../..
print_success "API deployed"
echo ""

# Build and deploy frontend
print_subsection "Step 8: Building and deploying frontend"
cd frontend
npm install
NODE_ENV=production \
NEXT_PUBLIC_API_URL=$API_URL \
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$USER_POOL_ID \
NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID \
NEXT_PUBLIC_AWS_REGION=$AWS_REGION \
npm run build

# Deploy strategy:
# - Upload immutable build assets with long cache
# - Upload HTML + route payloads with no-cache to prevent stale app shell in browsers
aws s3 sync out/_next s3://$ARTIFACTS_BUCKET/_next --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --region "$AWS_REGION"

# Sync everything else to root, but exclude artifact prefixes to prevent accidental deletion.
aws s3 sync out s3://$ARTIFACTS_BUCKET/ --delete \
  --exclude "_next/*" \
  --exclude "*/jobs/*" \
  --exclude "*/images/*" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --region "$AWS_REGION"

aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths '/*' --region "$AWS_REGION"
cd ..
print_success "Frontend deployed"
echo ""

# Get CloudFront URL
CF_URL=$(get_stack_output "leadmagnet-storage" "DistributionDomainName" "$AWS_REGION")

echo ""
print_section "Deployment Complete!"
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
echo "  --message-action SUPPRESS \\"
echo "  --region $AWS_REGION"
echo ""
