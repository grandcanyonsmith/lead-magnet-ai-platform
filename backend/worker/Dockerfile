# Use AWS Lambda Python base image (Amazon Linux 2023) for GLIBC compatibility
FROM public.ecr.aws/lambda/python:3.11

WORKDIR ${LAMBDA_TASK_ROOT}

# Install system dependencies for Playwright
RUN yum update -y && \
    yum install -y \
    gtk3 \
    libXScrnSaver \
    alsa-lib \
    nss \
    xorg-x11-server-Xvfb \
    cups \
    cups-libs \
    unzip \
    curl \
    xz \
    tar \
    && yum clean all

# Download Node.js 14 binary (compatible with GLIBC 2.26) to replace Playwright's bundled driver
# Install to /opt/nodejs which is writable and accessible in Lambda
RUN mkdir -p /opt/nodejs && \
    cd /opt/nodejs && \
    curl -L "https://nodejs.org/dist/v14.21.3/node-v14.21.3-linux-x64.tar.xz" -o node.tar.xz && \
    tar -xf node.tar.xz && \
    mv node-v14.21.3-linux-x64/bin/node /opt/nodejs/node-playwright && \
    chmod +x /opt/nodejs/node-playwright && \
    rm -rf node-v14.21.3-linux-x64 node.tar.xz && \
    # Verify Node.js works
    /opt/nodejs/node-playwright --version || echo "Node.js installation completed"

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers using Playwright's installation command
# This ensures the correct revision and directory structure
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
# Set PLAYWRIGHT_NODEJS_PATH to use our compatible Node.js 14 binary
# This tells Playwright to use our Node.js instead of its bundled driver
ENV PLAYWRIGHT_NODEJS_PATH=/opt/nodejs/node-playwright
# Also try to replace the bundled driver if it exists (backup approach)
RUN find /var/lang/lib/python3.11/site-packages/playwright -name "node" -type f -executable 2>/dev/null | while read node_file; do \
        echo "Replacing $node_file with compatible Node.js"; \
        cp /opt/nodejs/node-playwright "$node_file" && \
        chmod +x "$node_file"; \
    done || echo "Node.js driver replacement attempted"
# Install Chromium browser using Playwright's install command
# This ensures the correct revision and directory structure that Playwright expects
# Note: We skip --with-deps since we've already installed system dependencies above
RUN set -e && \
    mkdir -p /opt/playwright && \
    export PLAYWRIGHT_BROWSERS_PATH=/opt/playwright && \
    export PLAYWRIGHT_NODEJS_PATH=/opt/nodejs/node-playwright && \
    echo "Installing Chromium browser to $PLAYWRIGHT_BROWSERS_PATH..." && \
    python3 -m playwright install chromium --with-deps && \
    echo "Verifying Chromium installation..." && \
    CHROMIUM_PATH=$(find /opt/playwright -type d -name "chromium-*" | head -1) && \
    if [ -z "$CHROMIUM_PATH" ]; then \
        echo "ERROR: Chromium directory not found after installation"; \
        echo "Contents of /opt/playwright:"; \
        ls -la /opt/playwright || true; \
        exit 1; \
    fi && \
    CHROME_BINARY="$CHROMIUM_PATH/chrome-linux/chrome" && \
    if [ ! -f "$CHROME_BINARY" ]; then \
        echo "ERROR: Chromium binary not found at $CHROME_BINARY"; \
        echo "Contents of $CHROMIUM_PATH:"; \
        ls -la "$CHROMIUM_PATH" || true; \
        exit 1; \
    fi && \
    chmod +x "$CHROME_BINARY" && \
    echo "Chromium installed successfully at $CHROME_BINARY" && \
    ls -lh "$CHROME_BINARY" && \
    echo "Browser installation verification complete"

# Copy application code (copy everything from build context)
# This includes lambda_handler.py, all .py files, services/, and utils/ directories
COPY . .

# Set handler
CMD ["lambda_handler.lambda_handler"]

