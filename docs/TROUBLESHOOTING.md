# Troubleshooting Guide

This guide helps diagnose and resolve common issues in the Lead Magnet AI platform.

## Log Event Troubleshooting

### Understanding Log Events

The platform uses structured logging with prefixes to identify the source of log messages:

- `[Worker]` - Main worker process
- `[LambdaHandler]` - Lambda function handler
- `[AI Service]` - OpenAI API interactions
- `[S3]` - S3 operations
- `[TemplateService]` - Template rendering
- `[Processor]` - Job processing logic

### Common Log Events and Solutions

#### 1. `tool_choice='required'` with Empty Tools

**Error Message:**
```
[AI Service] CRITICAL: tool_choice='required' found in params with empty tools!
```

**Cause:**
A workflow step has `tool_choice='required'` but the tools array is empty or all tools were filtered out during validation.

**Solution:**
1. Check your workflow step configuration
2. Ensure at least one valid tool is included when `tool_choice='required'`
3. Common reasons tools get filtered:
   - `file_search` without `vector_store_ids`
   - `computer_use_preview` without proper container configuration
   - Invalid tool types

**Prevention:**
- Use `tool_choice='auto'` for most steps (recommended)
- Only use `tool_choice='required'` when tools are absolutely necessary
- Use `tool_choice='none'` for HTML generation/formatting steps

#### 2. Missing `output_text` from OpenAI API

**Error Message:**
```
OpenAI Responses API returned empty response. output_text is missing.
```

**Cause:**
The OpenAI Responses API call succeeded but didn't return `output_text` in the response.

**Solution:**
1. Check OpenAI API status and rate limits
2. Verify API key is valid and has sufficient credits
3. Check request parameters (model, instructions, input)
4. Review CloudWatch logs for API error details

**Prevention:**
- Monitor OpenAI API usage and quotas
- Implement retry logic for transient failures
- Validate API responses before processing

#### 3. Image Generation Not Working

**Symptoms:**
- `image_generation` tool is configured but no images are generated
- Logs show tool was called but no image URLs in response

**Cause:**
`tool_choice` was set to `'auto'` instead of `'required'`, so the model may skip image generation.

**Solution:**
The platform now automatically sets `tool_choice='required'` when `image_generation` tool is present. If you're still experiencing issues:

1. Verify `image_generation` tool is correctly configured in workflow step
2. Check that `tool_choice` is not explicitly set to `'none'`
3. Review CloudWatch logs for image generation API calls

**Prevention:**
- Use `image_generation` tool with `tool_choice='auto'` (will be automatically upgraded to `'required'`)
- Ensure workflow step instructions clearly request image generation

#### 4. Tools Filtered Out During Validation

**Warning Message:**
```
Skipping file_search tool - vector_store_ids not provided or empty
Skipping computer_use_preview tool - container parameter is REQUIRED but not provided
```

**Cause:**
Tools require additional configuration that wasn't provided.

**Solution:**
1. **For `file_search`**: Provide `vector_store_ids` array in tool configuration
2. **For `computer_use_preview`**: Provide `container` parameter with proper configuration
3. **For `code_interpreter`**: Container will be auto-added if missing

**Prevention:**
- Review tool documentation before adding to workflow
- Use tool validation in workflow editor to catch issues early
- Test workflow steps before deploying to production

#### 5. Workflow Step Processing Failures

**Error Message:**
```
Invalid workflow configuration: tool_choice='required' but no valid tools available
```

**Cause:**
All tools in a workflow step were filtered out during validation, but `tool_choice='required'` was still set.

**Solution:**
1. Review workflow step configuration
2. Add at least one valid tool, or change `tool_choice` to `'auto'` or `'none'`
3. Check tool configuration for missing required parameters

**Prevention:**
- Validate workflow steps before saving
- Use workflow editor validation features
- Test workflow steps individually before combining

### Log Analysis Tips

1. **Search by Prefix**: Filter logs by `[AI Service]`, `[Worker]`, etc. to focus on specific components
2. **Check Error Context**: Look for `extra` fields in log messages for additional context
3. **Trace Request Flow**: Follow `job_id` through logs to trace a specific job's execution
4. **Monitor Tool Validation**: Check for warnings about tools being filtered out

### CloudWatch Log Insights Queries

**Find all tool_choice errors:**
```
fields @timestamp, @message
| filter @message like /tool_choice.*required.*empty/
| sort @timestamp desc
```

**Find missing output_text errors:**
```
fields @timestamp, @message
| filter @message like /output_text.*missing/
| sort @timestamp desc
```

**Find image generation issues:**
```
fields @timestamp, @message
| filter @message like /image_generation/
| sort @timestamp desc
```

## API Error Handling

### OpenAI Responses API Errors

The platform now validates all OpenAI API responses and throws explicit errors instead of silently failing:

- **Missing `output_text`**: Throws error with context about which operation failed
- **Invalid tool configuration**: Raises `ValueError` with specific details
- **Empty tools with `tool_choice='required'`**: Raises `ValueError` before API call

### Error Response Format

All API errors include:
- Error message describing the issue
- Context about which operation failed
- HTTP status code (for API endpoints)
- Stack trace (in development mode)

## Best Practices

1. **Tool Configuration**:
   - Use `tool_choice='auto'` for most steps
   - Only use `tool_choice='required'` when tools are essential
   - Use `tool_choice='none'` for HTML/formatting steps

2. **Error Handling**:
   - Always check error messages for specific guidance
   - Review CloudWatch logs for detailed context
   - Test workflow steps individually before combining

3. **Monitoring**:
   - Set up CloudWatch alarms for critical errors
   - Monitor OpenAI API usage and quotas
   - Track workflow step success rates

4. **Debugging**:
   - Enable debug logging for detailed information
   - Use structured logging fields (`extra` parameter)
   - Trace requests using `job_id` through logs

