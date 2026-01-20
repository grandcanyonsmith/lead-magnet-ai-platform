# Lead Magnet AI Scripts

This directory contains utility scripts for managing, testing, and deploying the Lead Magnet AI platform.

## Overview

The scripts use shared utilities (`scripts/lib/`) for consistent configuration and error handling.
Always run scripts from the **repository root** unless specified otherwise.

## Directory Structure

```
scripts/
├── lib/                    # Shared utilities (Python, TS, Bash)
├── config.yaml             # Configuration file
├── deployment/             # Deployment scripts (deploy, destroy, build)
├── testing/                # Test suites (E2E, integration, unit helpers)
├── jobs/                   # Job management & debugging
├── workflows/              # Workflow migration & repair
├── admin/                  # User & tenant management
└── utils/                  # General utilities
```

## Common Tasks

### Deployment

```bash
# Deploy full stack
./scripts/deployment/deploy.sh

# Destroy full stack
./scripts/deployment/destroy.sh

# Build worker image
./scripts/deployment/build-and-push-worker-image.sh
```

### Testing

See [Testing Guide](../docs/testing/README.md) for full details.

```bash
# Run full E2E suite
./scripts/testing/test-e2e.sh

# Test webhooks
./scripts/testing/test-webhook.sh

# Smoke test Docker VM (CUA)
./scripts/testing/test-cua-docker-vm-smoke.sh --help
```

### Job Management

```bash
# Check status
python3 scripts/jobs/check-job-status.py <job_id>

# Get logs
python3 scripts/jobs/get-job-logs.py <job_id>

# Resubmit failed job
python3 scripts/jobs/resubmit-job.py <job_id> <tenant_id>
```

### Admin

```bash
# Set super admin
npx tsx scripts/admin/set-super-admin.ts user@example.com

# Create user
npx tsx scripts/admin/create-user.ts user@example.com password123 "Name"
```

## Configuration

Configuration is managed via:
1. **Environment Variables** (highest priority) - e.g. `AWS_REGION`, `API_URL`
2. **config.yaml** (in scripts directory)
3. **Defaults** (fallback)

## Validation

Run the validation script to check for common issues (missing imports, hardcoded values):

```bash
./scripts/validate-scripts.sh
```

## Development

When adding new scripts:
1. **Use shared utilities** from `lib/` (Python `lib.common`, TS `lib/common.ts`, Bash `lib/shell_common.sh`).
2. **Support `--help`** for CLI tools.
3. **Use `argparse`** (Python) or `parse_args` (Bash).
4. **Run validation** before committing.
