# Shell Tool (ECS Fargate) — Ops Runbook

This repo includes a public-facing “shell tool” integration that executes model-requested commands in AWS **ECS Fargate** and returns stdout/stderr back to the model via the OpenAI Responses API tool loop.

This is a **high-risk capability** (remote code execution). Treat incidents as security events.

## Architecture (high level)
- **Orchestrator**: `backend/api` (Lambda) calls OpenAI Responses. If the model emits `shell_call`, the API launches an ECS task and returns `shell_call_output`.
- **Executor**: ECS Fargate task runs `backend/shell-executor/runner.js` with a job payload passed via env and uploads a JSON result to S3 via presigned PUT.
- **Result bucket**: short-lived objects (1 day lifecycle) in the shell results bucket.

## Workspace persistence (EFS-backed /workspace)
The shell executor now mounts an **EFS** volume at `/workspace` so shell tool loops can persist files across multiple `shell_call` rounds (cookbook-style iteration).

Key points:
- **Files persist; processes do not**: each `shell_call` still runs in a new ECS task.
- **No task role**: executor remains credential-less; persistence is via VPC/EFS network controls.
- **Per-session directory**: when `workspace_id` is provided, the executor runs commands in:
  - `/workspace/sessions/<workspace_id>`
- **Reset semantics**: if `reset_workspace=true`, the executor wipes that directory before running commands.

### Internal contract fields (orchestrator → executor)
The internal job request JSON supports two optional fields:
- `workspace_id`: stable identifier for the persistent workspace directory
- `reset_workspace`: wipe the workspace directory before executing

Implementations:
- Executor: `backend/shell-executor/runner.js`
- Orchestrators:
  - API: `backend/api/src/services/shellExecutorService.ts`
  - Worker: `backend/worker/services/shell_executor_service.py`

### Public API shell tool endpoint (workspace control)
`POST /v1/tools/shell` supports:
- `workspace_id` (optional): reuse a workspace across requests
- `reset_workspace` (optional): wipe the workspace before running

This is useful for iterative sessions where later calls depend on files created by earlier calls.

## Emergency shutoff (kill switch)
Set the API Lambda environment variable:
- `SHELL_TOOL_ENABLED=false`

Effect:
- API will return **404** for `/v1/tools/shell` and will not execute any ECS tasks.

## Abuse controls (what’s enforced)
- **Per-IP quota**: `SHELL_TOOL_IP_LIMIT_PER_HOUR` (DynamoDB `leadmagnet-rate-limits` table, TTL-based counters)
- **Global concurrency cap**: `SHELL_TOOL_MAX_IN_FLIGHT` with optional queue wait `SHELL_TOOL_QUEUE_WAIT_MS`
- **Executor isolation**:
  - No inbound
  - Restricted egress (HTTPS + DNS)
  - No task IAM role (`TaskRoleArn` removed)
  - Read-only root filesystem + **EFS-backed `/workspace`**

## Shell loop runtime defaults
These control how long shell tool loops are allowed to run and how much output is returned.

Defaults (worker-side env vars):
- `SHELL_LOOP_MAX_ITERATIONS` (default: `25`)
- `SHELL_LOOP_MAX_DURATION_SECONDS` (default: `840`, ~14 minutes)
- `SHELL_EXECUTOR_DEFAULT_TIMEOUT_MS` (default: **unset** → executor default `900000ms`)
- `SHELL_EXECUTOR_DEFAULT_MAX_OUTPUT_LENGTH` (default: `4096`)

Per-step overrides (workflow step field `shell_settings`):
- `max_iterations`
- `max_duration_seconds`
- `command_timeout_ms`
- `command_max_output_length`

Notes:
- API validation caps values to safe ranges (e.g., duration under 15 minutes, command timeout ≤ 900000ms).
- Use per-step overrides for long or heavy shell tasks; otherwise rely on global defaults.

## Workflow pattern: “previous-step artifact → S3 upload”
Some workflows need to take an existing artifact from a previous step and upload it into an external S3 bucket (e.g. `cc360-pages`) and then pass the resulting object URL into the next step.

This repo supports a safe pattern for that when the step uses the `shell` tool:
- The worker injects a structured context block containing:
  - `SOURCE_ARTIFACT_URL` (from the previous step’s `artifact_id`)
  - `DEST_PUT_URL` (presigned S3 PUT URL)
  - `DEST_CONTENT_TYPE` (so the uploaded object serves correctly when public)
  - `DEST_OBJECT_URL` (public HTTPS URL to return)
- The model executes the upload with non-interactive commands (e.g. `curl`) and returns a **single-line JSON** payload containing `object_url` (and helpful metadata like `s3_uri`).

Implementation:
- Context injection: `backend/worker/services/step_processor.py`

Security controls:
- **Bucket allowlist**: `SHELL_S3_UPLOAD_ALLOWED_BUCKETS` (defaults to `cc360-pages`)
- **Key prefix enforcement**: `SHELL_S3_UPLOAD_KEY_PREFIX` (defaults to `leadmagnet/<tenant>/<job>/`)
- **IAM**: the signing principals (API + worker Lambda roles) must have `s3:PutObject` permission scoped to the allowed prefix (e.g. `arn:aws:s3:::cc360-pages/leadmagnet/*`).

## What to check during an incident
- **API logs**: CloudWatch logs for the API Lambda (look for `[ShellTool]`, `[ShellToolLoop]`, `[ShellExecutor]`)
- **ECS logs**: `/aws/ecs/leadmagnet-shell-executor`
- **Rate limit table**: `leadmagnet-rate-limits`
  - Keys used:
    - `rl#shell#ip#<ip>#hour#<YYYY-MM-DDTHH>`
    - `sem#shell#global`
- **S3 results bucket**:
  - Prefix: `shell-results/`
  - Objects should be short-lived; confirm lifecycle policy is active.

## Recommended containment steps (in order)
1. Set `SHELL_TOOL_ENABLED=false` (immediate stop).
2. Reduce `SHELL_TOOL_MAX_IN_FLIGHT` to `1` and set `SHELL_TOOL_QUEUE_WAIT_MS=0` (minimize blast radius if you must re-enable).
3. Lower `SHELL_TOOL_IP_LIMIT_PER_HOUR` temporarily.
4. If needed, **scale down** by setting ECS account/cluster task limits (or disable NAT/egress at the VPC level).

## Recovery checklist
- Review CloudWatch logs for executed commands and request IPs.
- Rotate any secrets that could have been exposed by executed commands.
- Consider adding stricter egress controls (domain allowlist via proxy) and moving the feature behind auth.


