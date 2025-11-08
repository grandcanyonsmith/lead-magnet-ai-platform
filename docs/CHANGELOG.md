# Changelog

> **Last Updated**: 2025-01-27  
> **Status**: Current  
> **Related Docs**: [Architecture Overview](./ARCHITECTURE.md), [Troubleshooting Guide](./TROUBLESHOOTING.md)

All notable changes to the Lead Magnet AI platform are documented in this file.

---

## [Unreleased] - 2025-11-07

### Added
- **AI Service Refactoring**: Extracted 8 helper methods from `generate_report()` method
  - `_is_o3_model()` - Model detection helper
  - `_validate_and_filter_tools()` - Consolidated tool validation (single source of truth)
  - `_build_input_text()` - Input text construction
  - `_build_api_params()` - API parameter building with safety checks
  - `_extract_image_urls()` - Image URL extraction from responses
  - `_process_api_response()` - Response processing and usage calculation
  - `_handle_openai_error()` - Centralized error handling with retry logic
  - `_clean_html_markdown()` - HTML markdown cleanup helper
- **Previous Step Outputs**: Each step now receives outputs from ALL previous steps
- **Image URL Passing**: Image URLs from previous steps are now included in context
- **Type Safety**: Added `normalize_step_order()` helper to handle DynamoDB type mismatches
- **Enhanced Logging**: Added detailed logging for previous context building and step processing
- **Error Handling**: Added validation for missing `output_text` in all OpenAI Responses API calls to prevent silent failures
- **Image Generation Tool Choice**: Automatically sets `tool_choice='required'` when `image_generation` tool is present
- **Troubleshooting Guide**: Added comprehensive troubleshooting documentation (`docs/TROUBLESHOOTING.md`)

### Changed
- **`ai_service.py`**: `generate_report()` method reduced from 638 lines to ~93 lines (85% reduction)
- **`processor.py`**: Updated step processing to correctly accumulate and pass previous step outputs
- **`processor.py`**: Added image URL normalization and inclusion in previous context
- **`processor.py`**: Added `normalize_step_order()` function to handle type mismatches
- **Error Handling**: Replaced silent fallbacks with explicit error throwing for missing API responses

### Fixed
- **Previous Step Context**: Fixed issue where steps weren't receiving outputs from all previous steps
- **Image URLs**: Fixed issue where image URLs weren't being passed in previous context
- **Type Comparison**: Fixed `'<' not supported between instances of 'int' and 'str'` error
- **Tool Validation**: Consolidated redundant validation checks into single function
- **Lambda Context**: Fixed `lambda_handler.py` to use `aws_request_id` instead of `request_id`
- **Silent Failures**: Fixed silent data loss when OpenAI Responses API returns empty `output_text` (Bugs 1-6)
  - Workflow generation now throws error instead of returning empty workflow
  - Template HTML generation now throws error instead of returning empty HTML
  - Template metadata generation now throws error instead of returning defaults
  - Form generation now throws error instead of returning default fields
  - Form CSS generation now throws error instead of returning empty CSS
- **Tool Choice Bug**: Fixed `tool_choice='required'` being set with empty tools array (now raises ValueError)
- **Image Generation**: Fixed image generation by automatically setting `tool_choice='required'` when `image_generation` tool is used

### Security
- **Tool Validation**: Added critical check to prevent `tool_choice='required'` with empty tools
- **Multiple Safety Checks**: Added multiple validation layers to prevent invalid API configurations
- **Error Handling**: Replaced silent failures with explicit errors to prevent data loss

---

## [2025-11-07] - DynamoDB Size Limit Fix and S3 Offloading

### Summary
Fixed critical DynamoDB item size limit errors by implementing automatic S3 offloading for large `execution_steps` data. This prevents `ValidationException` errors when job execution steps exceed DynamoDB's 400KB item size limit.

### Added
- **S3 Offloading**: Automatic detection and offloading of large `execution_steps` (> 300KB)
- **S3 Loading**: API layer automatically loads `execution_steps` from S3 when needed
- **Size Estimation**: 10% buffer added to size estimation for DynamoDB serialization overhead
- **Stale Key Cleanup**: Automatic cleanup of stale `execution_steps_s3_key` references

### Changed
- **Size Threshold**: Reduced from 350KB to 300KB for better safety margin
- **Worker Integration**: All `update_job()` calls now pass `s3_service` parameter
- **Error Logging**: Enhanced error logging for S3 load failures with S3 key included

### Fixed
- **DynamoDB ValidationException**: Item size exceeded 400KB errors eliminated
- **Stale S3 Keys**: Fixed bug where stale `execution_steps_s3_key` references were never cleaned up
- **GitHub Actions**: Fixed invalid `if` condition syntax in all workflow files
- **Missing Parameters**: Fixed missing `s3_service` parameter in some `update_job` calls

### Technical Details

#### Size Calculation
```python
def _estimate_dynamodb_size(self, value: Any) -> int:
    json_str = json.dumps(value, default=str)
    byte_size = len(json_str.encode('utf-8'))
    return int(byte_size * 1.1)  # 10% buffer
```

#### S3 Offloading Logic
- If `execution_steps` > 300KB, serialize to JSON and upload to S3
- Store S3 key (`execution_steps_s3_key`) in DynamoDB
- Remove `execution_steps` from DynamoDB update
- S3 Path: `jobs/{job_id}/execution_steps.json`

#### API Integration
- API automatically detects `execution_steps_s3_key` and loads from S3
- Transparent to API consumers - `execution_steps` always populated
- Error handling returns `null` on failure, logged but doesn't fail request

### Performance Impact
- **Positive**: Prevents DynamoDB write failures, enables unlimited execution_steps size
- **Trade-offs**: S3 upload/download adds ~50-200ms per operation
- **Mitigation**: Error handling prevents blocking, CloudFront caching reduces costs

### Migration Notes
- All changes are backward compatible
- Existing jobs with `execution_steps` in DynamoDB continue to work
- Jobs with large `execution_steps` automatically offloaded on next update
- API interface unchanged

### Monitoring
- **Key Metrics**: DynamoDB ValidationException errors (should be zero), S3 operations success rates
- **Log Patterns**: 
  - `"execution_steps for job {job_id} is too large"` - S3 offloading triggered
  - `"Stored execution_steps in S3 at {s3_key}"` - Successful offload
  - `"Error loading execution_steps from S3"` - S3 retrieval failure

---

## Previous Changes

For historical reference, see archived documentation:
- [Archived Changelogs](./archive/README.md) - Historical changelog entries
- [Refactoring Summary](./archive/REFACTORING_SUMMARY.md) - Comprehensive refactoring summary

## Related Documentation

- [Architecture Overview](./ARCHITECTURE.md) - System architecture details
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues and solutions
- [Resources](./RESOURCES.md) - AWS resource inventory

