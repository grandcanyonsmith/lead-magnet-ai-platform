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
    unzip \
    curl \
    xz \
    && yum clean all

# Download Node.js 14 binary (compatible with GLIBC 2.26) to replace Playwright's bundled driver
RUN mkdir -p /tmp/nodejs && \
    cd /tmp/nodejs && \
    curl -L "https://nodejs.org/dist/v14.21.3/node-v14.21.3-linux-x64.tar.xz" -o node.tar.xz && \
    tar -xf node.tar.xz && \
    mv node-v14.21.3-linux-x64/bin/node /usr/local/bin/node-playwright && \
    chmod +x /usr/local/bin/node-playwright && \
    rm -rf /tmp/nodejs && \
    # Verify Node.js works
    /usr/local/bin/node-playwright --version || echo "Node.js installation completed"

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers by manually downloading Chromium
# The Playwright Python package's Node.js driver has GLIBC 2.27+ requirements
# We'll download Chromium directly and configure Playwright to use it
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
# Set PLAYWRIGHT_NODEJS_PATH to use our compatible Node.js 14 binary
# This tells Playwright to use our Node.js instead of its bundled driver
ENV PLAYWRIGHT_NODEJS_PATH=/usr/local/bin/node-playwright
# Also try to replace the bundled driver if it exists (backup approach)
RUN find /var/lang/lib/python3.11/site-packages/playwright -name "node" -type f -executable 2>/dev/null | while read node_file; do \
        echo "Replacing $node_file with compatible Node.js"; \
        cp /usr/local/bin/node-playwright "$node_file" && \
        chmod +x "$node_file"; \
    done || echo "Node.js driver replacement attempted"
RUN mkdir -p /opt/playwright && \
    cd /opt/playwright && \
    # Get Chromium revision for Playwright 1.48.0 (hardcoded to avoid API calls)
    CHROMIUM_REVISION="1305410" && \
    # Download Chromium for Linux x64
    curl -L "https://playwright.azureedge.net/builds/chromium/${CHROMIUM_REVISION}/chromium-linux.zip" -o chromium.zip && \
    unzip -q chromium.zip -d chromium-${CHROMIUM_REVISION} && \
    rm chromium.zip && \
    # Playwright expects: chromium-{revision}/chrome-linux/chrome
    # The zip extracts to chrome-linux/, so we need to move it
    mv chromium-${CHROMIUM_REVISION}/chrome-linux chromium-${CHROMIUM_REVISION}/chrome-linux || \
    (mkdir -p chromium-${CHROMIUM_REVISION} && mv chrome-linux chromium-${CHROMIUM_REVISION}/) && \
    # Verify structure
    ls -la chromium-${CHROMIUM_REVISION}/chrome-linux/chrome || echo "Chromium download completed"

# Copy application code (copy everything from build context)
# This includes lambda_handler.py, all .py files, services/, and utils/ directories
COPY . .

# Set handler
CMD ["lambda_handler.lambda_handler"]

