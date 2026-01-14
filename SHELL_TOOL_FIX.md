# Shell Tool Fix - Enabled in Production

## Changes Made

### File: `infrastructure/lib/api-stack.ts`

**Before:**
```typescript
[ENV_VAR_NAMES.SHELL_TOOL_ENABLED]: process.env.SHELL_TOOL_ENABLED || 'false',
```

**After:**
```typescript
// Enable shell tool by default if shellExecutor is provided, otherwise respect env var or default to false
[ENV_VAR_NAMES.SHELL_TOOL_ENABLED]: process.env.SHELL_TOOL_ENABLED || (props.shellExecutor ? 'true' : 'false'),
```

## What This Fixes

The shell tool was being filtered out in production because:
1. `SHELL_TOOL_ENABLED` was explicitly set to `'false'` by default
2. The `ToolValidator._shell_tool_available()` method checks `SHELL_TOOL_ENABLED` first
3. If it's set to `'false'`, it returns `False` immediately, before checking `SHELL_EXECUTOR_FUNCTION_NAME`

## How It Works Now

1. **If `shellExecutor` is provided** (which it is in `infrastructure/bin/app.ts`):
   - `SHELL_TOOL_ENABLED` will be set to `'true'` by default
   - `SHELL_EXECUTOR_FUNCTION_NAME` will also be set
   - Shell tool will be available ✅

2. **If `shellExecutor` is NOT provided**:
   - `SHELL_TOOL_ENABLED` defaults to `'false'`
   - Shell tool will be disabled ✅

3. **Environment variable override**:
   - `process.env.SHELL_TOOL_ENABLED` can still override the default
   - This allows explicit control via environment variables

## Deployment

After deploying this change:
1. The API Lambda will have `SHELL_TOOL_ENABLED=true` (when shellExecutor is provided)
2. The Worker Lambda already has `SHELL_EXECUTOR_FUNCTION_NAME` set
3. Both conditions will make the shell tool available in production

## Verification

After deployment, check:
1. CloudWatch logs for the job processor Lambda - should NOT see:
   ```
   [ToolValidator] Shell tool requested but executor not configured; skipping tool
   ```
2. Workflow executions should be able to use the shell tool
3. Test with a workflow that includes shell tool in its tools list

## Related Files

- `infrastructure/lib/api-stack.ts` - API Lambda environment variables
- `infrastructure/lib/compute-stack.ts` - Worker Lambda environment variables (already correct)
- `infrastructure/bin/app.ts` - Stack instantiation (already passes shellExecutor)
- `backend/worker/services/tools/validator.py` - Tool availability check logic
