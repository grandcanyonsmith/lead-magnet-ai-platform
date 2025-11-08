#!/bin/bash
# Build Lambda Layer with Playwright browsers using Docker
# This creates a layer compatible with Lambda's Linux environment

set -e

echo "📦 Building Playwright Lambda Layer (using Docker)..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Create temporary directory for layer
LAYER_DIR="/tmp/playwright-layer-$$"
rm -rf "$LAYER_DIR"
mkdir -p "$LAYER_DIR"

echo "Building layer in Docker container..."
docker run --rm \
    -v "$LAYER_DIR:/output" \
    -w /output \
    public.ecr.aws/sam/build-python3.11:latest \
    bash -c "
        set -e && \
        mkdir -p python && \
        cd python && \
        echo 'Installing Playwright...' && \
        pip install playwright==1.48.0 --target . --platform manylinux2014_x86_64 --implementation cp --python-version 3.11 --only-binary=:all: && \
        echo 'Installing Chromium browser...' && \
        export PLAYWRIGHT_BROWSERS_PATH=/output/playwright_browsers && \
        mkdir -p \$PLAYWRIGHT_BROWSERS_PATH && \
        python3 -m playwright install chromium --with-deps && \
        echo 'Verifying browser installation...' && \
        if [ -d \"\$PLAYWRIGHT_BROWSERS_PATH/chromium-*\" ]; then \
            echo 'Browser installed successfully'; \
            ls -la \$PLAYWRIGHT_BROWSERS_PATH/; \
        else \
            echo 'Warning: Browser directory not found'; \
        fi
    " 2>&1 | tail -40

if [ ! -d "$LAYER_DIR/python" ]; then
    echo "❌ Error: Layer build failed"
    exit 1
fi

echo ""
echo "Creating layer zip..."
cd "$LAYER_DIR"
zip -r /tmp/playwright-layer.zip . -q

LAYER_SIZE=$(ls -lh /tmp/playwright-layer.zip | awk '{print $5}')
echo "✅ Layer created: /tmp/playwright-layer.zip"
echo "   Size: $LAYER_SIZE"

# Check if browsers were installed
if [ -d "$LAYER_DIR/python/playwright_browsers" ]; then
    BROWSER_COUNT=$(find "$LAYER_DIR/python/playwright_browsers" -type f -name "chrome" | wc -l | tr -d ' ')
    echo "   Browsers found: $BROWSER_COUNT"
else
    echo "   ⚠️  Warning: Browsers directory not found"
fi

# Cleanup
rm -rf "$LAYER_DIR"

echo ""
echo "🚀 To publish the layer, run:"
echo "   aws lambda publish-layer-version \\"
echo "     --layer-name playwright-browsers \\"
echo "     --zip-file fileb:///tmp/playwright-layer.zip \\"
echo "     --compatible-runtimes python3.11 \\"
echo "     --region us-east-1"
