# Shell Executor (ECS Task) — Local Dev

The ECS shell executor image (`backend/shell-executor`) runs `runner.js`, which:
- Reads a job payload from `SHELL_EXECUTOR_JOB_GET_URL` (presigned S3 URL) or legacy `SHELL_EXECUTOR_JOB_B64`/`SHELL_EXECUTOR_JOB_JSON`
- Executes the requested shell commands
- Uploads a result JSON to a presigned S3 PUT URL

For full operational details, see the **[Shell Tool Runbook](../../docs/SHELL_TOOL_RUNBOOK.md)**.

## AWS CLI v2

The Docker image includes **AWS CLI v2** (installed at build time).

## Using your local AWS credentials (for local runs only)

When running this container locally, you can reuse your host AWS config/credentials by bind-mounting `~/.aws` into the container.

The executor runs commands with `HOME=/workspace`, so it will look for credentials at `/workspace/.aws`.
For convenience, the runner will also symlink `/workspace/.aws -> /home/runner/.aws` if you mount there.

### Example

```bash
cd backend/shell-executor
docker build -t leadmagnet-shell-executor:dev .

# Mount your local AWS config (read-only) and run a simple aws command via the runner
docker run --rm \
  -v "$HOME/.aws:/home/runner/.aws:ro" \
  -e SHELL_EXECUTOR_JOB_JSON='{"version":"2025-12-29","job_id":"local-aws","commands":["aws --version"],"result_put_url":"https://example.com/","result_content_type":"application/json","timeout_ms":60000}' \
  leadmagnet-shell-executor:dev
```

Or use the helper script (recommended):

```bash
./run-local-with-aws.sh 'aws sts get-caller-identity'
```

### Notes
- `result_put_url` must be a valid presigned PUT URL for real runs (the example will fail upload).
- **Do not** mount or embed long-lived credentials in production ECS tasks. Prefer IAM task roles or presigned URLs.
