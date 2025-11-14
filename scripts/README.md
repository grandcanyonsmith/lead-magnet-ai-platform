# Lead Magnet AI Scripts

This directory contains utility scripts for managing, testing, and deploying the Lead Magnet AI platform.

## Overview

The scripts have been refactored to use shared utilities, eliminating code duplication and providing consistent interfaces. All scripts now use centralized configuration and common functions.

## Directory Structure

```
scripts/
├── lib/                    # Shared utilities
│   ├── common.py           # Python shared utilities
│   ├── common.ts           # TypeScript shared utilities
│   ├── shell_common.sh     # Shell shared utilities
│   ├── config.py           # Configuration management
│   └── image_processing_utils.py
├── config.yaml             # Configuration file
├── validate-scripts.sh     # Script validation tool
├── deployment/             # Deployment scripts
│   ├── deploy.sh
│   ├── destroy.sh
│   └── build-*.sh
├── testing/                # Test scripts
│   ├── test-*.sh
│   ├── test-*.py
│   └── test-*.ts
├── jobs/                   # Job management scripts
│   ├── check-job-*.py
│   ├── get-job-*.py
│   ├── resubmit-job.py
│   └── complete-failed-job.py
├── workflows/              # Workflow utilities
│   ├── import-workflow-*.py
│   ├── migrate-*.py
│   └── update-workflow-*.py
├── admin/                  # Admin scripts
│   ├── set-super-admin.*
│   ├── create-external-accounts.ts
│   └── fix-*.ts
└── utils/                  # Utility scripts
    ├── find-lead-magnet-jobs.py
    ├── process_image.py
    └── convert-dynamodb-format.py
```

## Shared Utilities

### Python Utilities (`lib/common.py`)

All Python scripts should import from `lib.common`:

```python
import sys
from pathlib import Path

# Add lib directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.common import (
    convert_decimals,
    get_dynamodb_resource,
    get_s3_client,
    get_table_name,
    get_artifacts_bucket,
    get_aws_region,
    find_step_functions_execution,
    print_section,
    format_timestamp,
)
```

**Key Functions:**

- `convert_decimals(obj)` - Convert DynamoDB Decimal types to Python int/float
- `get_dynamodb_resource()` - Get cached DynamoDB resource
- `get_s3_client()` - Get cached S3 client
- `get_table_name(table_type)` - Get table name (jobs, workflows, forms, etc.)
- `get_artifacts_bucket()` - Get artifacts S3 bucket name
- `get_aws_region()` - Get AWS region from environment or default
- `find_step_functions_execution(job_id)` - Find Step Functions execution for a job
- `print_section(title)` - Print formatted section header
- `format_timestamp(timestamp)` - Format timestamp for display

### TypeScript Utilities (`lib/common.ts`)

All TypeScript scripts should import from `lib/common`:

```typescript
import {
  getDynamoDbDocumentClient,
  getS3Client,
  getTableName,
  getAwsRegion,
  getArtifactsBucket,
  printSuccess,
  printError,
  printWarning,
  printInfo,
  printSection,
} from '../lib/common';
```

**Key Functions:**

- `getDynamoDbDocumentClient()` - Get cached DynamoDB Document client
- `getS3Client()` - Get cached S3 client
- `getCognitoClient()` - Get cached Cognito client
- `getTableName(tableType)` - Get table name (jobs, workflows, forms, etc.)
- `getArtifactsBucket()` - Get artifacts S3 bucket name (async)
- `getAwsRegion()` - Get AWS region from environment or default
- `printSuccess(message)` - Print success message
- `printError(message)` - Print error message
- `printWarning(message)` - Print warning message
- `printInfo(message)` - Print info message
- `printSection(title)` - Print formatted section header

### Shell Utilities (`lib/shell_common.sh`)

All shell scripts should source the common library:

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/shell_common.sh"
```

**Key Functions:**

- `print_success "message"` - Print success message in green
- `print_error "message"` - Print error message in red
- `print_warning "message"` - Print warning message in yellow
- `print_info "message"` - Print info message in blue
- `print_debug "message"` - Print debug message (if VERBOSE/DEBUG set)
- `print_section "title"` - Print formatted section header
- `check_prerequisites cmd1 cmd2 ...` - Check if required commands exist
- `get_aws_region` - Get AWS region from environment or default
- `get_aws_account_id` - Get AWS account ID
- `get_stack_output stack_name output_key` - Get CloudFormation stack output
- `get_api_url` - Get API URL from environment or CloudFormation
- `retry_aws_command max_attempts delay command` - Retry AWS command with backoff
- `parse_args` - Parse command line arguments (supports --help, --region, --debug, --verbose)

## Configuration

Configuration is managed through:

1. **Environment Variables** (highest priority)
   - `AWS_REGION` - AWS region
   - `API_URL` - API Gateway URL
   - `{TABLE_TYPE}_TABLE` - Override table names (e.g., `JOBS_TABLE`)

2. **config.yaml** (in scripts directory)
   ```yaml
   defaults:
     region: us-east-1
     api_url: https://...
   tables:
     jobs: leadmagnet-jobs
     workflows: leadmagnet-workflows
   ```

3. **Defaults** (lowest priority)
   - Region: `us-east-1`
   - Tables: `leadmagnet-{type}`

## Script Categories

### Job Management Scripts (`jobs/`)

- `check-job-status.py` - Check job status and Step Functions execution
- `get-job-logs.py` - Fetch CloudWatch logs for a job
- `get-job-artifacts.py` - Get job artifacts and URLs
- `get-job-output.py` - Retrieve and save job output to files
- `get-job-output-urls.py` - Fetch output URLs for job IDs
- `check-job-steps.py` - Check job execution steps
- `resubmit-job.py` - Resubmit a failed job
- `complete-failed-job.py` - Complete a failed job by extracting last step output

**Usage Examples:**

```bash
# Check job status
python3 scripts/jobs/check-job-status.py job_12345

# Get job logs
python3 scripts/jobs/get-job-logs.py job_12345

# Resubmit a failed job
python3 scripts/jobs/resubmit-job.py job_12345 tenant_12345

# Get job output and save to files
python3 scripts/jobs/get-job-output.py job_12345 tenant_12345 --upload
```

### Deployment Scripts (`deployment/`)

- `deploy.sh` - Full deployment (infrastructure, worker, API, frontend)
- `destroy.sh` - Destroy all infrastructure
- `build-lambda-worker.sh` - Build Lambda deployment package
- `build-playwright-layer.sh` - Build Playwright layer
- `build-and-push-worker-image.sh` - Build and push Docker image

**Usage:**

```bash
# Deploy everything
./scripts/deployment/deploy.sh

# Deploy with custom region
AWS_REGION=us-west-2 ./scripts/deployment/deploy.sh

# Destroy infrastructure
./scripts/deployment/destroy.sh
```

### Test Scripts (`testing/`)

- `test-e2e.sh` - End-to-end test suite
- `test-webhook.sh` - Test webhook functionality
- `test-form-e2e.sh` - Test form submission
- `test-e2e-job-processing.py` - Python E2E test for job processing
- `test-responses-api.ts` - Test OpenAI Responses API integration
- `test-brand-settings.ts` - Test brand settings functionality

**Usage:**

```bash
# Run E2E tests
./scripts/testing/test-e2e.sh

# Test webhook
./scripts/testing/test-webhook.sh

# Run TypeScript tests
npx tsx scripts/testing/test-responses-api.ts
```

### Workflow Scripts (`workflows/`)

- `import-workflow-from-job.py` - Import workflow from a job
- `import-workflow-from-json.py` - Import workflow from JSON file
- `migrate-legacy-workflows-to-steps.py` - Migrate legacy workflows to steps format
- `update-workflow-fields.py` - Update workflow fields
- `fix-workflow-tools.py` - Fix workflow tools

### Admin Scripts (`admin/`)

- `set-super-admin.ts` - Set SUPER_ADMIN role for a user
- `create-external-accounts.ts` - Create external accounts in database
- `fix-missing-customers.ts` - Fix missing Customer records
- `migrate-tenant-to-customer.ts` - Migrate from tenant_id to customerId structure
- `confirm-users.sh` - Confirm users in Cognito

**Usage:**

```bash
# Set super admin
npx tsx scripts/admin/set-super-admin.ts user@example.com

# Create external accounts
npx tsx scripts/admin/create-external-accounts.ts
```

### Utility Scripts (`utils/`)

- `find-lead-magnet-jobs.py` - Find lead magnet generation jobs
- `check-legacy-workflow-usage.py` - Check legacy workflow usage
- `process_image.py` - Process images
- `convert-dynamodb-format.py` - Convert DynamoDB format

## Validation

Run the validation script to check for common issues:

```bash
./scripts/validate-scripts.sh
```

This checks for:
- Hardcoded table names and regions
- Missing imports from shared utilities
- Missing argparse in Python scripts
- Missing error handling in shell scripts
- Duplicate utility functions

## Best Practices

1. **Always use shared utilities** - Don't duplicate code
2. **Use argparse for Python scripts** - Consistent CLI interfaces
3. **Source shell_common.sh** - Consistent output formatting
4. **Use configuration system** - Don't hardcode values
5. **Add help text** - All scripts should support `--help`
6. **Handle errors gracefully** - Use try/except and proper error messages
7. **Use TypeScript utilities** - Import from `lib/common.ts` for TypeScript scripts
8. **Run validation** - Use `validate-scripts.sh` before committing changes

## Migration Guide

If you have existing scripts that need to be updated:

1. **Python Scripts:**
   - Add path setup: `sys.path.insert(0, str(Path(__file__).parent.parent))`
   - Import from `lib.common`
   - Replace hardcoded table names with `get_table_name()`
   - Replace hardcoded regions with `get_aws_region()`
   - Replace `convert_decimals()` with shared version
   - Use `argparse` instead of `sys.argv`
   - Use shared AWS clients
   - Add `--region` argument support

2. **TypeScript Scripts:**
   - Import from `../lib/common`
   - Replace hardcoded table names with `getTableName()`
   - Replace hardcoded regions with `getAwsRegion()`
   - Use shared AWS clients
   - Use shared print functions for output

3. **Shell Scripts:**
   - Source `lib/shell_common.sh` (adjust path for subdirectories)
   - Replace color definitions with print functions
   - Use `get_aws_region()` instead of hardcoding
   - Use `get_stack_output()` for CloudFormation outputs
   - Add `parse_args` for argument parsing
   - Add `SCRIPT_HELP` variable for help text

## Examples

### Example Python Script

```python
#!/usr/bin/env python3
"""Example script using shared utilities."""

import sys
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from lib.common import (
    get_dynamodb_resource,
    get_table_name,
    get_aws_region,
    print_section,
)

def main():
    parser = argparse.ArgumentParser(description="Example script")
    parser.add_argument("job_id", help="Job ID")
    parser.add_argument("--region", help="AWS region")
    args = parser.parse_args()
    
    if args.region:
        import os
        os.environ["AWS_REGION"] = args.region
    
    print_section("Example Script")
    print(f"Job ID: {args.job_id}")
    print(f"Region: {get_aws_region()}")
    
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(get_table_name("jobs"))
    # ... rest of script

if __name__ == "__main__":
    main()
```

### Example Shell Script

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/shell_common.sh"

show_header "Example Script" "Description here"

print_info "Doing something..."
# ... script logic
print_success "Done!"
```

## Troubleshooting

**Issue: Module not found**
- Ensure `sys.path.insert(0, str(Path(__file__).parent))` is at the top
- Check that `lib/common.py` exists

**Issue: Shell functions not found**
- Ensure `source "$SCRIPT_DIR/lib/shell_common.sh"` is called
- Check that `lib/shell_common.sh` exists and is executable

**Issue: Wrong table names**
- Check `config.yaml` or environment variables
- Use `get_table_name()` function instead of hardcoding

## Contributing

When adding new scripts:

1. Use shared utilities from `lib/`
2. Follow existing patterns
3. Add help text (`--help` flag)
4. Update this README if adding new categories
5. Test with different regions/configurations

