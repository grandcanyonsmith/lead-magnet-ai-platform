# Authentication System

> **Last Updated**: 2025-01-14  
> **Status**: Current  
> **Related Docs**: [Architecture Overview](./ARCHITECTURE.md), [Flow Diagram](./FLOW_DIAGRAM.md)

Complete documentation for the authentication and authorization system used in the Lead Magnet AI Platform.

## Overview

The platform uses AWS Cognito for user authentication with JWT tokens, and implements a custom authorization system that supports:

- **Multi-tenant data isolation** via customer IDs
- **Role-based access control** (USER, SUPER_ADMIN)
- **Email-based SUPER_ADMIN elevation** via allowlist
- **Session-based impersonation** for support/admin use cases
- **Agency view** for SUPER_ADMIN users to manage multiple customers

## Authentication Flow

### 1. User Login

Users authenticate via AWS Cognito:
1. Frontend sends credentials to Cognito
2. Cognito validates and returns JWT tokens (ID token, access token, refresh token)
3. Frontend stores tokens in localStorage
4. Frontend includes ID token in `Authorization: Bearer <token>` header for API requests

### 2. API Gateway Authorization

API Gateway uses a JWT authorizer:
1. Validates JWT token signature and expiration
2. Extracts claims from token
3. Passes claims to Lambda function via `event.requestContext.authorizer.jwt.claims`

### 3. Auth Context Extraction

The Lambda function extracts authentication context from JWT claims:

```typescript
// Main entry point
const authContext = await extractAuthContext(event);
```

This function:
1. Extracts user ID from `claims.sub`
2. Gets email from claims or database lookup
3. Determines role (JWT claim → allowlist check → default USER)
4. Handles impersonation sessions if present
5. Resolves customer ID for multi-tenant isolation
6. Extracts agency view context for SUPER_ADMIN users

## Role System

### Role Hierarchy

Roles are determined in this order of precedence:

1. **JWT Claim**: `custom:role` from Cognito token
2. **Allowlist Check**: Email in SUPER_ADMIN allowlist → elevated to SUPER_ADMIN
3. **Default**: `USER` if no role specified

### Role Elevation

Users with emails in the SUPER_ADMIN allowlist are automatically elevated:

- **Configuration**: Set via `SUPER_ADMIN_EMAILS` environment variable (comma-separated)
- **Default**: `canyon@coursecreator360.com` is always included
- **Persistence**: Elevated role is persisted to database for consistency
- **Runtime**: Elevation happens on every request (checks allowlist, updates DB if needed)

### Role Persistence

When a user is elevated to SUPER_ADMIN via allowlist:
- Role is immediately updated in the `leadmagnet-users` table
- Ensures role persists across sessions
- Database becomes source of truth for subsequent requests

## Multi-Tenant Data Isolation

### Customer ID Resolution

Customer ID determines which tenant's data a user can access. Resolution order:

1. **If impersonating**: Acting user's `customer_id` from database
2. **JWT Claim**: `custom:customer_id` from token
3. **User Record**: Lookup `customer_id` from `leadmagnet-users` table

**Important**: Customer ID is required. If not found, authentication fails.

### Data Isolation

All database queries are scoped by `customer_id`:
- Jobs, workflows, forms, templates are filtered by customer
- Users can only access resources belonging to their customer
- SUPER_ADMIN can override via agency view

## Agency View

### Overview

Agency view allows SUPER_ADMIN users to manage multiple customer accounts from a single interface.

### How It Works

1. **Frontend**: Sends headers when switching views:
   - `x-view-mode: agency` or `x-view-mode: subaccount`
   - `x-selected-customer-id: <customer_id>` (when in agency view)

2. **Backend**: Extracts headers and adjusts `customerId`:
   - **Agency view**: Uses `selectedCustomerId` if provided, otherwise uses real user's customer
   - **Subaccount view**: Uses acting user's customer (normal behavior)

3. **Data Access**: All queries use the effective `customerId` from agency context

### View Modes

- **`agency`**: SUPER_ADMIN can see/manage all customers
  - Uses `selectedCustomerId` for data queries
  - If no `selectedCustomerId`, defaults to real user's customer
  
- **`subaccount`**: Normal single-customer view
  - Uses acting user's customer (standard behavior)

### Restrictions

- Only SUPER_ADMIN users can use agency view
- Non-SUPER_ADMIN users are ignored if they send agency view headers
- Agency view headers are validated but don't affect non-SUPER_ADMIN users

## Impersonation

### Session-Based Impersonation

SUPER_ADMIN users can impersonate other users for support purposes.

### Flow

1. **Create Session**: POST `/admin/impersonation/start`
   - Creates a session record in `leadmagnet-sessions` table
   - Returns `session_id`

2. **Use Session**: Frontend includes session ID in requests:
   - Header: `x-session-id: <session_id>`
   - Or: `Authorization: Session <session_id>`

3. **Backend Resolution**:
   - Looks up session by `session_id`
   - Verifies `real_user_id` matches authenticated user
   - Checks session expiration
   - Uses `acting_user_id` for customer ID resolution

4. **End Session**: POST `/admin/impersonation/end`
   - Deletes session record

### Session Structure

```typescript
{
  session_id: string;
  real_user_id: string;    // SUPER_ADMIN user
  acting_user_id: string;  // User being impersonated
  expires_at: number;       // Unix timestamp
  created_at: string;
}
```

### Security

- Sessions expire after configured time (default: 1 hour)
- Only SUPER_ADMIN can create impersonation sessions
- Session validation happens on every request
- Expired sessions are automatically rejected

## API Endpoints

### GET /me

Returns current user information and authentication context.

**Response Structure**:

```typescript
{
  realUser: {
    user_id: string;
    email: string;
    name?: string;
    customer_id: string;
    // Note: role field removed - use top-level 'role' instead
  },
  actingUser: {
    user_id: string;
    email: string;
    name?: string;
    customer_id: string;
    // Note: role field removed - use top-level 'role' instead
  },
  role: string;              // Effective role (single source of truth)
  customerId: string;        // Effective customer ID (includes agency view)
  isImpersonating: boolean;
  viewMode?: 'agency' | 'subaccount';
  selectedCustomerId?: string;
}
```

**Key Fields**:

- **`role`**: Single source of truth for authorization. Includes allowlist elevation.
- **`customerId`**: Effective customer ID used for data queries. May differ from `realUser.customer_id` if in agency view.
- **`viewMode`**: Current view mode (only set for SUPER_ADMIN)
- **`selectedCustomerId`**: Selected customer in agency view (only set when `viewMode === 'agency'`)

## Frontend Integration

### Auth Context Hook

Frontend uses React context to manage authentication:

```typescript
const { role, customerId, viewMode, setViewMode } = useAuth();
```

### View Switcher

SUPER_ADMIN users see a view switcher component that:
- Shows current view mode (Agency or Subaccount)
- Lists all customers for switching
- Sends appropriate headers when switching views
- Updates localStorage for persistence

### Header Management

Frontend automatically includes headers for authenticated requests:
- `Authorization: Bearer <id_token>` - JWT token
- `x-session-id: <session_id>` - Impersonation session (if active)
- `x-view-mode: agency|subaccount` - View mode (SUPER_ADMIN only)
- `x-selected-customer-id: <customer_id>` - Selected customer (agency view only)

## Security Considerations

### Token Storage

- Tokens stored in localStorage (frontend)
- Tokens validated on every request (backend)
- Expired tokens rejected automatically

### Role Elevation

- Allowlist checked on every request
- Database updated immediately when elevated
- No caching of role elevation (always fresh check)

### Customer ID Validation

- Customer ID is required for all authenticated requests
- Missing customer ID causes authentication failure
- No fallback to prevent data leakage

### Agency View Security

- Only SUPER_ADMIN can use agency view
- Headers validated but ignored for non-SUPER_ADMIN
- Selected customer ID validated against database

### Impersonation Security

- Sessions expire automatically
- Only SUPER_ADMIN can create sessions
- Session validation on every request
- Expired sessions rejected

## Configuration

### Environment Variables

- `SUPER_ADMIN_EMAILS`: Comma-separated list of emails for SUPER_ADMIN elevation
- `SESSIONS_TABLE`: DynamoDB table name for impersonation sessions (default: `leadmagnet-sessions`)
- `USERS_TABLE`: DynamoDB table name for users (default: `leadmagnet-users`)

### Cognito Configuration

- User Pool configured with custom attributes:
  - `custom:role` - User role
  - `custom:customer_id` - Customer ID for multi-tenant isolation
  - `custom:email` - User email (fallback)

## Troubleshooting

### User Not Getting SUPER_ADMIN Role

1. Check email is in `SUPER_ADMIN_EMAILS` environment variable
2. Verify email matches exactly (case-insensitive)
3. Check CloudWatch logs for role elevation messages
4. Verify database was updated with SUPER_ADMIN role

### Agency View Not Working

1. Verify user has SUPER_ADMIN role (check `/me` endpoint)
2. Check frontend is sending `x-view-mode` header
3. Verify `x-selected-customer-id` is valid customer ID
4. Check CloudWatch logs for agency view context extraction

### Impersonation Not Working

1. Verify session was created successfully
2. Check session hasn't expired
3. Verify `x-session-id` header is being sent
4. Check CloudWatch logs for session validation

### Customer ID Missing

1. Verify JWT token includes `custom:customer_id` claim
2. Check user record in database has `customer_id`
3. Verify user is not in impersonation session without acting user's customer_id
4. Check CloudWatch logs for customer ID resolution

## Related Documentation

- [Architecture Overview](./ARCHITECTURE.md) - System architecture including auth
- [Flow Diagram](./FLOW_DIAGRAM.md) - Process flows including authentication
- [Deployment Guide](./DEPLOYMENT.md) - Infrastructure setup including Cognito

