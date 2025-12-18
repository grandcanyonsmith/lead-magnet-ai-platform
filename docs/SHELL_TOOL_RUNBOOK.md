# Shell Tool (ECS Fargate) — Ops Runbook

This repo includes a public-facing “shell tool” integration that executes model-requested commands in AWS **ECS Fargate** and returns stdout/stderr back to the model via the OpenAI Responses API tool loop.

This is a **high-risk capability** (remote code execution). Treat incidents as security events.

## Architecture (high level)
- **Orchestrator**: `backend/api` (Lambda) calls OpenAI Responses. If the model emits `shell_call`, the API launches an ECS task and returns `shell_call_output`.
- **Executor**: ECS Fargate task runs `backend/shell-executor/runner.js` with a job payload passed via env and uploads a JSON result to S3 via presigned PUT.
- **Result bucket**: short-lived objects (1 day lifecycle) in the shell results bucket.

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
  - Read-only root filesystem + ephemeral `/workspace`

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


