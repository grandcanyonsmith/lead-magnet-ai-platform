# Webhook Feature Documentation

> **Last Updated**: 2025-11-12  
> **Status**: Production Ready  
> **Related Docs**: [Webhook Testing Guide](./WEBHOOK_TESTING.md), [Architecture Overview](./ARCHITECTURE.md)

## Overview

The webhook feature allows users to trigger workflow executions via public POST endpoints. Each user gets a unique webhook URL that accepts POST requests with workflow information and form data to automatically create jobs and trigger workflow processing.

## Features

- **Unique Webhook URLs**: Each user has a single, unique webhook token-based URL
- **Public Endpoint**: No authentication required (secured by unique token)
- **Flexible Workflow Identification**: Supports both `workflow_id` and `workflow_name`
- **Flexible Form Data**: Accepts any data structure (no strict validation)
- **Auto Token Generation**: Webhook tokens are automatically generated when users access settings
- **Token Management**: Users can regenerate webhook tokens from the dashboard

## Architecture

### Components

1. **Webhook Token Generation** (`backend/api/src/utils/webhookToken.ts`)
   - Generates cryptographically secure tokens using `crypto.randomBytes`
   - URL-safe base64 encoding (32 bytes = ~43 characters)

2. **Webhooks Controller** (`backend/api/src/controllers/webhooks.ts`)
   - Handles incoming webhook POST requests
   - Looks up user by webhook token
   - Validates workflow exists and belongs to user
   - Creates submission and job records
   - Triggers workflow execution

3. **Settings Controller Updates** (`backend/api/src/controllers/settings.ts`)
   - Auto-generates webhook tokens if missing
   - Returns webhook URL in settings response
   - Provides token regeneration endpoint

4. **Frontend Settings Page** (`frontend/src/app/dashboard/settings/page.tsx`)
   - Displays webhook URL
   - Copy button for easy sharing
   - Regenerate button for token rotation

### Database Schema

**User Settings Table** (`leadmagnet-user-settings`)
- Added field: `webhook_token` (String) - Unique token for webhook URL

### API Endpoints

#### Public Endpoints

**POST `/v1/webhooks/{token}`**
- Public endpoint (no authentication required)
- Accepts POST requests with workflow info and form data
- Returns job_id and status

**Request Body:**
```json
{
  "workflow_id": "wf_xxxxx",  // OR "workflow_name": "My Workflow"
  "form_data": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+14155551234",
    // ... any additional fields
  }
}
```

**Response:**
```json
{
  "message": "Webhook received and job processing started",
  "job_id": "job_xxxxx",
  "status": "pending"
}
```

#### Admin Endpoints

**GET `/admin/settings/webhook`**
- Returns webhook URL and token for authenticated user

**POST `/admin/settings/webhook/regenerate`**
- Regenerates webhook token for authenticated user
- Returns new webhook URL

**GET `/admin/settings`**
- Now includes `webhook_url` field in response

## Usage Examples

### Basic Usage with workflow_id

```bash
curl -X POST "https://your-api-url/v1/webhooks/YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "wf_01K957WHF8VRR7BZN9W5AAYPDD",
    "form_data": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+14155551234",
      "custom_field": "Custom value"
    }
  }'
```

### Usage with workflow_name

```bash
curl -X POST "https://your-api-url/v1/webhooks/YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_name": "My Workflow Name",
    "form_data": {
      "name": "Jane Smith",
      "email": "jane@example.com",
      "phone": "+14155551235"
    }
  }'
```

### JavaScript/Node.js Example

```javascript
const response = await fetch('https://your-api-url/v1/webhooks/YOUR_TOKEN', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    workflow_id: 'wf_xxxxx',
    form_data: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+14155551234',
      custom_field: 'Value'
    }
  })
});

const result = await response.json();
console.log('Job ID:', result.job_id);
```

### Python Example

```python
import requests

response = requests.post(
    'https://your-api-url/v1/webhooks/YOUR_TOKEN',
    json={
        'workflow_id': 'wf_xxxxx',
        'form_data': {
            'name': 'John Doe',
            'email': 'john@example.com',
            'phone': '+14155551234',
            'custom_field': 'Value'
        }
    }
)

result = response.json()
print(f"Job ID: {result['job_id']}")
```

## Security Considerations

1. **Token Security**: Webhook tokens are cryptographically secure (32 random bytes)
2. **Public Endpoint**: No authentication required - token is the only security
3. **Token Rotation**: Users can regenerate tokens if compromised
4. **Workflow Validation**: System validates workflow belongs to token owner
5. **Rate Limiting**: Consider implementing rate limiting for production use

## Error Handling

### Invalid Token (404)
```json
{
  "error": "Invalid webhook token"
}
```

### Workflow Not Found (404)
```json
{
  "error": "Workflow not found"
}
```

### Missing Workflow Identifier (400)
```json
{
  "error": "Either workflow_id or workflow_name is required"
}
```

### Workflow Permission Denied (403)
```json
{
  "error": "You don't have permission to access this workflow"
}
```

## Implementation Details

### Token Generation
- Uses Node.js `crypto.randomBytes(32)` for secure randomness
- URL-safe base64 encoding (replaces `+` with `-`, `/` with `_`, removes `=`)
- Tokens are ~43 characters long

### User Lookup
- Currently uses table scan to find user by webhook_token
- For production at scale, consider adding GSI on `webhook_token` field
- Acceptable performance for MVP with low user volume

### Form Data Handling
- Accepts any data structure in `form_data` or `submission_data`
- Ensures `name`, `email`, and `phone` are present (uses defaults if missing)
- All form data is preserved in submission record

### Workflow Execution
- Creates submission record (without form_id if workflow doesn't have one)
- Creates job record with status "pending"
- Triggers Step Functions execution (or local processing in dev)
- Returns immediately with job_id (async processing)

## Frontend Integration

### Settings Page
- Webhook URL displayed in "Delivery Settings" section
- Read-only input field with monospace font
- Copy button for easy sharing
- Regenerate button with confirmation dialog
- Example curl command displayed below URL

### Getting Your Webhook URL
1. Navigate to Settings (`/dashboard/settings`)
2. Scroll to "Delivery Settings" section
3. Copy your webhook URL from the "Your Webhook URL" field

## Testing

See [Webhook Testing Guide](./WEBHOOK_TESTING.md) for detailed testing instructions.

### Quick Test
```bash
# Get your webhook token from settings
WEBHOOK_TOKEN="your_token_here"
WORKFLOW_ID="wf_xxxxx"

# Test webhook
curl -X POST "https://your-api-url/v1/webhooks/$WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"workflow_id\": \"$WORKFLOW_ID\",
    \"form_data\": {
      \"name\": \"Test User\",
      \"email\": \"test@example.com\",
      \"phone\": \"+14155551234\"
    }
  }"
```

## Deployment Notes

### Environment Variables
- `API_URL` or `API_GATEWAY_URL`: Used to construct full webhook URLs
- If not set, webhook URLs will be relative paths

### Database Migration
- No migration required - `webhook_token` field is added automatically
- Existing users will get tokens generated on first settings access

### Backward Compatibility
- Existing API endpoints unchanged
- New endpoints are additive
- No breaking changes

## Future Enhancements

- [ ] Multiple webhook URLs per user
- [ ] Webhook URL aliases/names
- [ ] Webhook usage analytics
- [ ] Rate limiting per webhook
- [ ] Webhook event history/logs
- [ ] GSI on webhook_token for faster lookups
- [ ] Webhook signature verification
- [ ] Custom webhook response templates

## Related Files

- `backend/api/src/utils/webhookToken.ts` - Token generation
- `backend/api/src/controllers/webhooks.ts` - Webhook handler
- `backend/api/src/controllers/settings.ts` - Settings with webhook management
- `backend/api/src/routes.ts` - Route definitions
- `backend/api/src/utils/validation.ts` - Webhook request validation
- `frontend/src/app/dashboard/settings/page.tsx` - Settings UI
- `frontend/src/lib/api/settings.client.ts` - Settings API client

