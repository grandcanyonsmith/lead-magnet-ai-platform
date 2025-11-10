#!/bin/bash
set -e

echo "Building Lambda deployment package..."

# Clean previous builds
rm -rf package lambda-package.zip

# Create package directory
mkdir -p package

# Install Python dependencies (excluding playwright - using layer)
pip install \
    boto3==1.34.50 \
    "openai>=1.30.0,<2.0.0" \
    python-dotenv==1.0.1 \
    jinja2==3.1.3 \
    markdown==3.5.2 \
    beautifulsoup4==4.12.3 \
    requests==2.31.0 \
    ulid-py==1.1.0 \
    "httpx>=0.27.0" \
    --target ./package \
    --platform manylinux2014_x86_64 \
    --only-binary=:all: \
    --no-cache-dir

# Install playwright (will be provided by layer, but need the package)
pip install playwright==1.48.0 \
    --target ./package \
    --platform manylinux2014_x86_64 \
    --only-binary=:all: \
    --no-cache-dir

echo "Copying application code..."
# Copy application files
cp -r *.py package/
cp -r services package/ 2>/dev/null || true
cp -r utils package/ 2>/dev/null || true
cp -r templates package/ 2>/dev/null || true

# Create ZIP
cd package
echo "Creating ZIP file..."
zip -r ../lambda-package.zip . -q

cd ..
echo "Package size:"
du -h lambda-package.zip

echo "✅ Lambda package created: lambda-package.zip"
