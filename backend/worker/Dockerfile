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
    && yum clean all

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers by manually downloading Chromium
# The Playwright Python package's Node.js driver has GLIBC 2.27+ requirements
# We'll download Chromium directly and configure Playwright to use it
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
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

# Copy application code (explicitly copy all necessary files and directories)
COPY lambda_handler.py .
COPY *.py ./
COPY services/ ./services/
COPY utils/ ./utils/

# Set handler
CMD ["lambda_handler.lambda_handler"]

