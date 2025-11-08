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
    && yum clean all

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers
RUN python -m playwright install chromium --with-deps

# Copy application code
COPY . .

# Set handler
CMD ["lambda_handler.lambda_handler"]

