#!/bin/bash
# Build Lambda deployment package without Docker
# This script builds the Lambda package locally for deployment

set -e

cd "$(dirname "$0")/../backend/worker"

echo "📦 Building Lambda deployment package (no Docker required)..."

# Create temporary directory for package
PACKAGE_DIR="/tmp/lambda-package-$$"
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

# Copy Python files
echo "Copying Python files..."
cp -r *.py "$PACKAGE_DIR/"

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt --target "$PACKAGE_DIR" --platform manylinux2014_x86_64 --implementation cp --python-version 3.11 --only-binary=:all: 2>&1 | grep -E "(Collecting|Installing|Successfully)" || true

# Create zip file
echo "Creating deployment package..."
cd "$PACKAGE_DIR"
zip -r /tmp/lambda-deployment.zip . -q

echo "✅ Package created: /tmp/lambda-deployment.zip"
echo "   Size: $(ls -lh /tmp/lambda-deployment.zip | awk '{print $5}')"

# Cleanup
rm -rf "$PACKAGE_DIR"

echo ""
echo "🚀 To deploy, run:"
echo "   aws lambda update-function-code \\"
echo "     --function-name leadmagnet-compute-JobProcessorLambda4949D7F4-kqmEYYCZ4wa9 \\"
echo "     --zip-file fileb:///tmp/lambda-deployment.zip \\"
echo "     --region us-east-1"

