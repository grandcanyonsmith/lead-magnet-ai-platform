# Testing Index

Use this index to pick the right level of coverage before shipping. Everything under `docs/testing/` is grouped by how it is exercised—either scripted/automated or manual scenario playbooks.

## Automated / Script-backed Suites

| Doc | What it covers | Primary Commands |
| --- | --- | --- |
| `FRONTEND_TEST_GUIDE.md` | How to run the Playwright/Next lint suites for the dashboard. | `npm run lint`, `npx playwright test` |
| `TEST_WORKFLOW_GENERATION_E2E.md` | End-to-end workflow generation with webhook callbacks (both Node & Bash harnesses plus optional manual flow). | `node scripts/test-workflow-generation-e2e.js`, `./scripts/test-workflow-generation-e2e.sh` |
| `TEST_STEP_RERUN.md` | Verifies that rerunning a single job step only reprocesses that step while preserving context. | `python3 scripts/testing/test-step-rerun.py <job_id> <step_index>` |
| `TEST_WEBHOOK_ARTIFACTS.md` | Programmatic verification that webhook payloads include the expected artifact bundle. | `./scripts/test-webhook-artifacts-now.sh` |
| `VERIFY_WEBHOOK_ARTIFACTS.md` | Smoke test to confirm artifacts land in S3 + webhook recipients after deploys. | `./verify-webhook-artifacts.sh` (see doc for env vars) |
| `TEST_QUICK_EDIT.md` | Scripted quick-edit regression that exercises `/admin/jobs/:id/quick-edit-step`. | `node scripts/test-quick-edit.js` |

> **Tip:** `scripts/test-e2e.sh` chains the most common API + UI happy-paths. Run it before every release along with the domain-specific suites above.

## Manual Scenario Guides

These walkthroughs document how to validate UI/UX changes and production behaviours that are hard to automate today.

| Doc | Scenario |
| --- | --- |
| `TESTING_GUIDE.md` | High-level checklist for smoke-testing the entire product (auth, workflows, forms, deliveries). |
| `MANUAL_TESTING_GUIDE.md` | Markdown/HTML artifact rendering checks inside the artifacts dashboard. |
| `MOBILE_TESTING.md` | Steps to validate responsive/mobile workflows end-to-end. |
| `COMPLETE_MOBILE_TESTING_SUMMARY.md` | Snapshot of the last full mobile regression results. |
| `WORKFLOW_EDIT_MOBILE_TEST.md` | Detailed reproduction steps for editing workflows on mobile viewports. |
| `SETTINGS_PAGE_TEST_SUMMARY.md` | What to verify on the Settings tab after UI or API adjustments. |
| `QUICK_EDIT_TESTING.md` | Manual drill for confirm-in-place edits (pairs nicely with the quick edit script). |
| `TEST_IMAGE_IMPROVEMENTS_SUMMARY.md` | Results + checklist for the image artifact improvments rollout. |
| `WEBHOOK_TESTING.md` | Manual webhook validation flow (headers, retries, payload shape). |
| `TEST_WEBHOOK_ARTIFACTS.md` (manual section) | Contains observation checklist when co-monitoring webhook artifacts with the script. |

### How to Use

1. **Pick the domain** you touched (workflows, forms, jobs, templates, notifications, settings).
2. **Run the matching automated suite** from the first table.
3. **Spot-check the manual guide** that mirrors your change (UI behaviour, webhook payloads, device-specific layouts).
4. Record results directly inside the Markdown files or link them in the PR description for auditability.

When you add a new test playbook, drop the `.md` file into this directory and extend the relevant table here so the rest of the team—and AI assistants—can find it.
