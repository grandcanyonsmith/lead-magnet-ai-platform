#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${RED}Lead Magnet AI Platform - Cleanup Script${NC}"
echo "=================================================="
echo ""
echo -e "${YELLOW}WARNING: This will delete all resources!${NC}"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cleanup cancelled."
    exit 0
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-east-1}

echo ""
echo "Starting cleanup..."
echo ""

# Empty and delete S3 buckets
echo -e "${YELLOW}Emptying S3 buckets...${NC}"
ARTIFACTS_BUCKET="leadmagnet-artifacts-$AWS_ACCOUNT_ID"
aws s3 rm s3://$ARTIFACTS_BUCKET --recursive || true
echo -e "${GREEN}✓ S3 buckets emptied${NC}"
echo ""

# Delete ECR repository
echo -e "${YELLOW}Deleting ECR repository...${NC}"
aws ecr delete-repository --repository-name leadmagnet/worker --force || true
echo -e "${GREEN}✓ ECR repository deleted${NC}"
echo ""

# Delete CDK stacks
echo -e "${YELLOW}Deleting CDK stacks...${NC}"
cd infrastructure
npx cdk destroy --all --force
cd ..
echo -e "${GREEN}✓ CDK stacks deleted${NC}"
echo ""

echo -e "${GREEN}Cleanup complete!${NC}"

