#!/bin/bash
# Deploy webhook artifacts feature to Lambda (Container Image)

set -e

echo "🚀 Deploying webhook artifacts feature to Lambda..."
echo ""

# Get ECR repository URI
echo "📋 Getting ECR repository..."
ECR_REPO=$(aws ecr describe-repositories --repository-names leadmagnet/worker --region us-east-1 --query 'repositories[0].repositoryUri' --output text 2>/dev/null || echo "")

if [ -z "$ECR_REPO" ]; then
    echo "❌ ECR repository 'leadmagnet/worker' not found."
    echo "Checking available repositories..."
    aws ecr describe-repositories --region us-east-1 --query 'repositories[?contains(repositoryName, `worker`)].repositoryName' --output table
    echo ""
    echo "Please deploy WorkerStack first:"
    echo "   cd infrastructure && npx cdk deploy WorkerStack"
    exit 1
fi

echo "✅ ECR Repository: $ECR_REPO"
echo ""

# Login to ECR
echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REPO
echo ""

# Build image for Linux x86_64 (Lambda architecture)
echo "🐳 Building Docker image for Linux x86_64..."
cd backend/worker
docker buildx build --platform linux/amd64 -t leadmagnet-worker:latest --load .
echo ""

# Tag for ECR
echo "🏷️  Tagging image..."
docker tag leadmagnet-worker:latest $ECR_REPO:latest
echo ""

# Push to ECR
echo "📤 Pushing to ECR..."
docker push $ECR_REPO:latest
echo ""

# Update Lambda function to use new image
FUNCTION_NAME="leadmagnet-compute-JobProcessorLambda4949D7F4-QfZWMq9MkyHG"
echo "🔄 Updating Lambda function..."
aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --image-uri "$ECR_REPO:latest" \
    --region us-east-1 \
    --output json | jq -r '[.FunctionName, .LastUpdateStatus, .CodeSize] | @tsv' | column -t || \
    aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --image-uri "$ECR_REPO:latest" \
        --region us-east-1

echo ""
echo "✅ Deployment initiated!"
echo ""
echo "To check deployment status:"
echo "  aws lambda get-function --function-name $FUNCTION_NAME --region us-east-1 --query 'Configuration.LastUpdateStatus'"
echo ""
echo "To view logs after testing:"
echo "  aws logs tail /aws/lambda/$FUNCTION_NAME --follow --region us-east-1"
echo ""
echo "To verify the image was updated:"
echo "  aws lambda get-function --function-name $FUNCTION_NAME --region us-east-1 --query 'Code.ImageUri'"
