# Use Microsoft's official Playwright Python image (has browser + dependencies pre-installed)
FROM mcr.microsoft.com/playwright/python:v1.48.0-jammy

ENV LAMBDA_TASK_ROOT=/var/task
WORKDIR ${LAMBDA_TASK_ROOT}

# Install AWS Lambda Runtime Interface Client
RUN pip install --no-cache-dir awslambdaric

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY *.py ./
COPY services/ ./services/
COPY utils/ ./utils/

# Set the CMD to your handler
ENTRYPOINT [ "python3", "-m", "awslambdaric" ]
CMD [ "lambda_handler.lambda_handler" ]