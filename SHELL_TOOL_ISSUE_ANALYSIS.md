# Shell Tool Not Used in Production - Analysis

## Job Details
- **Job ID**: `job_01KEZ38TJKKKG7RC8289JYN8Q8`
- **Submission ID**: `sub_01KEZ38THP5VQED1WQ25DVHQTG`
- **Workflow ID**: `wf_01KEZ1GW5PVZ70ZKJ4J59TDVDA`
- **Tenant ID**: `cust_84c8e438`
- **Last Updated**: 1/14/2026, 1:41:44 PM

## Root Cause

The shell tool was **filtered out** during tool validation because it was not available in the production environment.

### Shell Tool Availability Check

The `ToolValidator._shell_tool_available()` method in `backend/worker/services/tools/validator.py` checks three conditions:

```python
def _shell_tool_available() -> bool:
    enabled_flag = (os.environ.get("SHELL_TOOL_ENABLED") or "").strip().lower()
    if enabled_flag and enabled_flag not in ("true", "1", "yes"):
        return False
    if (os.environ.get("IS_LOCAL") or "").strip().lower() == "true":
        return True
    return bool((os.environ.get("SHELL_EXECUTOR_FUNCTION_NAME") or "").strip())
```

The shell tool is available if **any** of these are true:
1. `SHELL_TOOL_ENABLED` is set to "true", "1", or "yes" (or not set at all)
2. `IS_LOCAL` is set to "true"
3. `SHELL_EXECUTOR_FUNCTION_NAME` is set

### Production Configuration Issue

Looking at the infrastructure code:

**`infrastructure/lib/api-stack.ts` (line 137):**
```typescript
[ENV_VAR_NAMES.SHELL_TOOL_ENABLED]: process.env.SHELL_TOOL_ENABLED || 'false',
```

**`infrastructure/lib/api-stack.ts` (lines 141-143):**
```typescript
...(props.shellExecutor ? {
  [ENV_VAR_NAMES.SHELL_EXECUTOR_FUNCTION_NAME]: props.shellExecutor.functionName,
} : {}),
```

**`infrastructure/lib/compute-stack.ts` (lines 61-63):**
```typescript
...(props.shellExecutor ? {
  [ENV_VAR_NAMES.SHELL_EXECUTOR_FUNCTION_NAME]: props.shellExecutor.functionName,
} : {}),
```

### What Happened

In production:
1. ✅ `SHELL_TOOL_ENABLED` defaults to `'false'` (explicitly set)
2. ❌ `IS_LOCAL` is not `'true'` (production environment)
3. ❌ `SHELL_EXECUTOR_FUNCTION_NAME` is not set (only set if `props.shellExecutor` is provided)

Result: `_shell_tool_available()` returns `False`

### Tool Filtering

When tools are validated in `ToolValidator.validate_and_filter_tools()`:

```python
if tool_type == "shell" and not shell_tool_available:
    logger.warning(
        "[ToolValidator] Shell tool requested but executor not configured; skipping tool",
        extra={"model": model, "tool_choice": tool_choice},
    )
    continue  # Shell tool is filtered out
```

The shell tool was requested but silently filtered out, and a warning should have been logged.

## Solution

To enable the shell tool in production, you need to:

### Option 1: Set SHELL_TOOL_ENABLED=true
Set the environment variable `SHELL_TOOL_ENABLED=true` in production.

### Option 2: Provide shellExecutor in CDK props
Ensure that `props.shellExecutor` is provided when creating the stacks, which will set `SHELL_EXECUTOR_FUNCTION_NAME`.

### Option 3: Check Logs
Look for the warning log message:
```
[ToolValidator] Shell tool requested but executor not configured; skipping tool
```

This will confirm that the shell tool was requested but filtered out.

## Files to Check

1. **Tool Validation**: `backend/worker/services/tools/validator.py` (lines 75-84, 136-141)
2. **Infrastructure Config**: 
   - `infrastructure/lib/api-stack.ts` (line 137)
   - `infrastructure/lib/compute-stack.ts` (lines 61-63)
3. **Environment Variables**: Check CloudWatch logs or Lambda environment variables for:
   - `SHELL_TOOL_ENABLED`
   - `SHELL_EXECUTOR_FUNCTION_NAME`
   - `IS_LOCAL`

## Expected Behavior

When the shell tool is requested but not available:
- ✅ Tool is filtered out silently
- ✅ Warning log is written
- ✅ Workflow continues without shell tool
- ❌ No error is thrown (this is intentional)

## Recommendation

1. **Check CloudWatch logs** for the job to confirm the warning message was logged
2. **Review infrastructure deployment** to see if `SHELL_TOOL_ENABLED` or `shellExecutor` props are configured
3. **Decide if shell tool should be enabled** in production (it's a high-risk capability)
4. **If enabling**, update the infrastructure configuration accordingly
