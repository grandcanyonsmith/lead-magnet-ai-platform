# API Documentation

## Overview

This API provides endpoints for managing workflows, forms, templates, jobs, and other resources in the Lead Magnet platform.

## Base URL

The API base URL depends on your deployment:
- Production: `https://api.example.com`
- Development: `http://localhost:3000`

## Authentication

Most endpoints require authentication via JWT tokens. Include the token in the `Authorization` header:

```
Authorization: Bearer <token>
```

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {},
  "requestId": "request-id"
}
```

### Error Codes

- `AUTHENTICATION_REQUIRED` (401): User is not authenticated
- `AUTHORIZATION_FAILED` (403): User doesn't have permission
- `VALIDATION_ERROR` (400): Request validation failed
- `NOT_FOUND` (404): Resource not found
- `CONFLICT` (409): Resource conflict
- `RATE_LIMIT_EXCEEDED` (429): Rate limit exceeded
- `INTERNAL_ERROR` (500): Internal server error
- `SERVICE_UNAVAILABLE` (503): Service temporarily unavailable

## Rate Limiting

Rate limits are applied per user/IP address:
- Standard endpoints: 1000 requests per hour
- Form submissions: 10 requests per hour per IP

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Endpoints

### Workflows

#### List Workflows
`GET /admin/workflows`

Query Parameters:
- `limit` (number): Maximum number of results (default: 50)
- `offset` (number): Pagination offset (default: 0)
- `status` (string): Filter by status (draft, active, archived)

Response:
```json
{
  "workflows": [...],
  "count": 10
}
```

#### Get Workflow
`GET /admin/workflows/:id`

Response:
```json
{
  "workflow_id": "...",
  "workflow_name": "...",
  ...
}
```

#### Create Workflow
`POST /admin/workflows`

Request Body:
```json
{
  "workflow_name": "...",
  "workflow_description": "...",
  "steps": [...]
}
```

#### Update Workflow
`PUT /admin/workflows/:id`

#### Delete Workflow
`DELETE /admin/workflows/:id`

### Forms

#### List Forms
`GET /admin/forms`

#### Get Form
`GET /admin/forms/:id`

#### Get Public Form
`GET /forms/:slug`

Public endpoint - no authentication required.

#### Submit Form
`POST /forms/:slug`

Request Body:
```json
{
  "submission_data": {
    "name": "...",
    "email": "...",
    "phone": "..."
  }
}
```

Response:
```json
{
  "message": "Thank you!",
  "job_id": "...",
  "redirect_url": "..."
}
```

### Jobs

#### List Jobs
`GET /admin/jobs`

Query Parameters:
- `workflow_id` (string): Filter by workflow
- `status` (string): Filter by status
- `limit` (number): Page size (default: 20)
- `offset` (number): Pagination offset

#### Get Job
`GET /admin/jobs/:id`

#### Get Job Artifacts
`GET /admin/jobs/:id/artifacts`

### Templates

#### List Templates
`GET /admin/templates`

#### Get Template
`GET /admin/templates/:id`

#### Create Template
`POST /admin/templates`

#### Update Template
`PUT /admin/templates/:id`

#### Delete Template
`DELETE /admin/templates/:id`

## Security Headers

All responses include security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy: default-src 'self'`
- `Referrer-Policy: strict-origin-when-cross-origin`

## CORS

CORS is configured via the `CORS_ORIGINS` environment variable. In development, all origins are allowed. In production, only configured origins are allowed.

