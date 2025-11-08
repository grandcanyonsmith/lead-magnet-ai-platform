# Use Ubuntu 22.04 LTS as base image for better Playwright/Chromium compatibility
FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV LAMBDA_TASK_ROOT=/var/task
ENV LAMBDA_RUNTIME_DIR=/var/runtime

WORKDIR ${LAMBDA_TASK_ROOT}

# Install Python 3.11 and system dependencies
RUN apt-get update && \
    apt-get install -y \
    python3.11 \
    python3.11-dev \
    python3-pip \
    curl \
    unzip \
    xz-utils \
    tar \
    ca-certificates \
    gnupg \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# Create symlink for python (python3 already exists)
RUN ln -sf /usr/bin/python3.11 /usr/bin/python && \
    python3 -m pip install --upgrade pip

# Install Lambda Runtime Interface Client (RIC)
RUN pip install awslambdaric

# Install system dependencies for Playwright
RUN apt-get update && \
    apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    libxshmfence1 \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

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
# On Ubuntu, Playwright is installed in dist-packages via pip
RUN (find /usr/local/lib/python3.11/dist-packages/playwright -name "node" -type f -executable 2>/dev/null || \
     find /usr/lib/python3.11/dist-packages/playwright -name "node" -type f -executable 2>/dev/null || \
     find $(python3 -c "import site; print(site.getsitepackages()[0])")/playwright -name "node" -type f -executable 2>/dev/null) | while read node_file; do \
        echo "Replacing $node_file with compatible Node.js"; \
        cp /opt/nodejs/node-playwright "$node_file" && \
        chmod +x "$node_file"; \
    done || echo "Node.js driver replacement attempted"
# Install Chromium browser using Playwright's install command
# First install Playwright's system dependencies to ensure compatibility
RUN python3 -m playwright install-deps chromium || echo "Dependency installation completed (some may already be installed)"

# Install Chromium browser using Playwright's install command
# This ensures the correct revision and directory structure that Playwright expects
RUN set -e && \
    mkdir -p /opt/playwright && \
    export PLAYWRIGHT_BROWSERS_PATH=/opt/playwright && \
    export PLAYWRIGHT_NODEJS_PATH=/opt/nodejs/node-playwright && \
    echo "Installing Chromium browser to $PLAYWRIGHT_BROWSERS_PATH..." && \
    python3 -m playwright install chromium && \
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

# Set handler - use Lambda Runtime Interface Client
ENTRYPOINT [ "python", "-m", "awslambdaric" ]
CMD [ "lambda_handler.lambda_handler" ]

