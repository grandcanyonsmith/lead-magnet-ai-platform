# Admin Scripts

This directory contains administrative scripts for managing users, workflows, and data sharing.

## Workflow Sharing Scripts

### Comprehensive Script (Recommended)

**`share-workflow-complete.ts`** - Share everything in one go
- Shares workflow, jobs, artifacts, and form submissions
- Creates shared copies for the target user
- Future items are automatically shared via `workflowSharingService`
- **Usage**: `npx tsx scripts/admin/share-workflow-complete.ts <workflow_id_or_template_id> <email>`

### Individual Scripts (For Granular Control)

**`share-workflow-to-user.ts`** - Share only the workflow
- Creates a copy of the workflow for the target user
- Also shares the associated form if it exists
- **Usage**: `npx tsx scripts/admin/share-workflow-to-user.ts <workflow_id_or_template_id> <email>`

**`share-jobs-to-user.ts`** - Share only jobs
- Creates copies of all jobs for a shared workflow
- Requires the workflow to already be shared
- **Usage**: `npx tsx scripts/admin/share-jobs-to-user.ts <workflow_id> <email>`

**`share-artifacts-to-user.ts`** - Share only artifacts
- Creates copies of all artifacts for shared jobs
- Requires jobs to already be shared
- **Usage**: `npx tsx scripts/admin/share-artifacts-to-user.ts <workflow_id> <email>`

**`share-submissions-to-user.ts`** - Share only form submissions
- Creates copies of all form submissions
- Updates shared jobs to reference the new submission IDs
- **Usage**: `npx tsx scripts/admin/share-submissions-to-user.ts <workflow_id> <email>`

**`share-all-jobs-and-artifacts.ts`** - Share jobs and artifacts together
- Combines job and artifact sharing in one script
- **Usage**: `npx tsx scripts/admin/share-all-jobs-and-artifacts.ts <workflow_id> <email>`

## User Management Scripts

**`create-user.ts`** - Create a new user account
- Creates user in Cognito and DynamoDB
- Sets password and name
- **Usage**: `npx tsx scripts/admin/create-user.ts <email> <password> <name>`

**`create-and-set-super-admin.ts`** - Create user and set as super admin
- Creates user account
- Sets SUPER_ADMIN role in Cognito and DynamoDB
- Creates customer record
- **Usage**: `npx tsx scripts/admin/create-and-set-super-admin.ts <email> <password> <name>`

**`set-super-admin.ts`** - Set existing user as super admin
- Updates role for existing user
- **Usage**: `npx tsx scripts/admin/set-super-admin.ts <email>`

## Workflow Transfer Scripts

**`transfer-workflow-to-user.ts`** - Transfer workflow ownership
- **Note**: This transfers ownership (moves data), not shares (creates copies)
- Use sharing scripts for collaboration scenarios
- **Usage**: `npx tsx scripts/admin/transfer-workflow-to-user.ts <workflow_id_or_template_id> <email>`

## Migration Scripts

**`migrate-tenant-to-customer.ts`** - Migrate tenant data to customer structure
- **Usage**: `npx tsx scripts/admin/migrate-tenant-to-customer.ts`

**`fix-missing-customers.ts`** - Fix missing customer records
- **Usage**: `npx tsx scripts/admin/fix-missing-customers.ts`

## Notes

- All scripts require AWS credentials to be configured
- Environment variables are loaded from `.env` file
- Scripts use `ulid` for ID generation (consistent with codebase)
- Future items (jobs, artifacts, submissions) are automatically shared via `workflowSharingService` once workflows are shared







