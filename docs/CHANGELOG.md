# Changelog

All notable changes to the Lead Magnet AI platform will be documented in this file.

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

### Changed
- **`ai_service.py`**: `generate_report()` method reduced from 638 lines to ~93 lines (85% reduction)
- **`processor.py`**: Updated step processing to correctly accumulate and pass previous step outputs
- **`processor.py`**: Added image URL normalization and inclusion in previous context
- **`processor.py`**: Added `normalize_step_order()` function to handle type mismatches

### Fixed
- **Previous Step Context**: Fixed issue where steps weren't receiving outputs from all previous steps
- **Image URLs**: Fixed issue where image URLs weren't being passed in previous context
- **Type Comparison**: Fixed `'<' not supported between instances of 'int' and 'str'` error
- **Tool Validation**: Consolidated redundant validation checks into single function
- **Lambda Context**: Fixed `lambda_handler.py` to use `aws_request_id` instead of `request_id`

### Security
- **Tool Validation**: Added critical check to prevent `tool_choice='required'` with empty tools
- **Multiple Safety Checks**: Added multiple validation layers to prevent invalid API configurations

---

## Previous Changes

See individual changelog files:
- `CHANGELOG_DYNAMODB_FIX.md` - DynamoDB size limit fixes
- `REFACTORING_SUMMARY.md` - Comprehensive refactoring summary

