# Admin Scripts

This directory contains administrative scripts for managing users, workflows, and data sharing.

## Prerequisites

- **Node.js 20+**
- **AWS Credentials** configured in your environment (`~/.aws/credentials` or env vars)
- **tsx** installed (`npm install -g tsx` or use `npx tsx`)

## User Management

| Script | Description | Usage |
| --- | --- | --- |
| `create-user.ts` | Create a new user in Cognito + DynamoDB. | `npx tsx scripts/admin/create-user.ts <email> <password> <name>` |
| `set-super-admin.ts` | Promote an existing user to SUPER_ADMIN. | `npx tsx scripts/admin/set-super-admin.ts <email>` |
| `create-and-set-super-admin.ts` | Create + Promote in one step. | `npx tsx scripts/admin/create-and-set-super-admin.ts <email> <password> <name>` |
| `confirm-users.sh` | Batch confirm Cognito users. | `./scripts/admin/confirm-users.sh` |
| `authorize-user.js` | Generate an auth token for testing. | `node scripts/admin/authorize-user.js <user_pool_id> <client_id> <username> <password>` |

## Workflow Sharing & Transfer

**Recommended:** Use `share-workflow-complete.ts` for most sharing needs.

| Script | Description | Usage |
| --- | --- | --- |
| `share-workflow-complete.ts` | Share workflow, jobs, artifacts, and submissions. | `npx tsx scripts/admin/share-workflow-complete.ts <id> <email>` |
| `share-workflow-to-user.ts` | Share only the workflow structure. | `npx tsx scripts/admin/share-workflow-to-user.ts <id> <email>` |
| `share-jobs-to-user.ts` | Share jobs for an already-shared workflow. | `npx tsx scripts/admin/share-jobs-to-user.ts <workflow_id> <email>` |
| `share-artifacts-to-user.ts` | Share artifacts for shared jobs. | `npx tsx scripts/admin/share-artifacts-to-user.ts <workflow_id> <email>` |
| `transfer-workflow-to-user.ts` | **Transfer ownership** (move, don't copy). | `npx tsx scripts/admin/transfer-workflow-to-user.ts <id> <email>` |

## Data Migration & Fixes

| Script | Description | Usage |
| --- | --- | --- |
| `migrate-tenant-to-customer.ts` | Migrate legacy tenant data to customer model. | `npx tsx scripts/admin/migrate-tenant-to-customer.ts` |
| `fix-missing-customers.ts` | Create missing Customer records for users. | `npx tsx scripts/admin/fix-missing-customers.ts` |
| `create-external-accounts.ts` | Initialize external account records. | `npx tsx scripts/admin/create-external-accounts.ts` |

## Configuration

Scripts use the shared configuration from `scripts/config.yaml` and respect standard AWS environment variables (`AWS_REGION`, `AWS_PROFILE`).
