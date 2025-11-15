#!/bin/bash
# Build and push Lambda container image with Playwright

set -e

# Get the project root directory (two levels up from this script)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT/backend/worker"

echo "🐳 Building Lambda container image..."

# Get ECR repository URI
ECR_REPO=$(aws ecr describe-repositories --repository-names leadmagnet/worker --region us-east-1 --query 'repositories[0].repositoryUri' --output text 2>/dev/null || echo "")

if [ -z "$ECR_REPO" ]; then
    echo "❌ ECR repository not found. Please deploy WorkerStack first:"
    echo "   cd infrastructure && npx cdk deploy WorkerStack"
    exit 1
fi

echo "ECR Repository: $ECR_REPO"

# Login to ECR
echo "Logging in to ECR..."
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REPO

# Build image for Linux x86_64 (Lambda architecture) using buildx
echo "Building Docker image for Linux x86_64..."
docker buildx build --platform linux/amd64 -t leadmagnet-worker:latest --load .

# Tag for ECR
docker tag leadmagnet-worker:latest $ECR_REPO:latest

# Push to ECR
echo "Pushing to ECR..."
docker push $ECR_REPO:latest

echo "✅ Image pushed successfully!"
echo ""
echo "To deploy the updated Lambda function:"
echo "   cd infrastructure && npx cdk deploy ComputeStack"

