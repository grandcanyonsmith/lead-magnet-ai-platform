# Use Microsoft's official Playwright Python image (has browser + dependencies pre-installed)
# Version must match the playwright package version in requirements.txt
FROM mcr.microsoft.com/playwright/python:v1.48.0-jammy

ENV LAMBDA_TASK_ROOT=/var/task
WORKDIR ${LAMBDA_TASK_ROOT}

# Install AWS Lambda Runtime Interface Client
RUN pip install --no-cache-dir awslambdaric

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# The base image already has browsers, but ensure they're accessible
# Set PLAYWRIGHT_BROWSERS_PATH to the default location used by the base image
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Verify browsers are available (base image should have them)
RUN python3 -m playwright install-deps chromium || true

# Copy application code
COPY *.py ./
COPY services/ ./services/
COPY utils/ ./utils/

# Set the CMD to your handler
ENTRYPOINT [ "python3", "-m", "awslambdaric" ]
CMD [ "lambda_handler.lambda_handler" ]
