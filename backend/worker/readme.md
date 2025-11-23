# Lead Magnet AI Worker

This directory contains the Python Lambda worker for the Lead Magnet AI Platform. The worker is responsible for processing jobs, generating AI reports, and rendering HTML templates.

## Overview

The worker is invoked with a `JOB_ID` environment variable and coordinates:
- Database operations via DynamoDB
- File storage via S3
- AI generation and HTML templating
- Error handling and notification

## Architecture Diagram

```mermaid
graph TD
    A[Step Function] -->|Invoke Lambda| B[Worker]
    B --> C[JobProcessor]
    C --> D[DynamoDBService]
    C --> E[S3Service]
    C --> F[AIService]
    F --> G[OpenAIClient]
    C --> H[TemplateService]
    C --> I[ErrorHandlerService]
```

## Worker Flow Sequence

```mermaid
sequenceDiagram
    participant StepFunc as Step Function
    participant Lambda as Worker Lambda
    participant Proc as JobProcessor
    participant AI as AIService
    participant Tmpl as TemplateService
    StepFunc->>Lambda: Start ($JOB_ID)
    Lambda->>Proc: process_job(job_id)
    Proc->>AI: Run AI pipeline
    AI->>AI: OpenAI API Calls
    Proc->>Tmpl: Render HTML
    Proc->>Lambda: Return result
```

## Key Files
- `worker.py`: Entry point
- `core/`: Core service modules
- `services/`: Specialized worker services

For more info, see the code and comments in each Python file.

