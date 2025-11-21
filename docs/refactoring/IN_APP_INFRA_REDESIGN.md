# In-App Backend/Infrastructure Redesign

> **Objective:** Rebuild the Lead Magnet AI backend inside the application boundary (no managed AWS services) while keeping the existing submission → research → HTML → delivery flow intact for ≤10 GB ETL jobs.

---

## 1. Current AWS Responsibilities (Inventory)

| Concern | AWS Component | Responsibilities / Notes |
| --- | --- | --- |
| API surface & auth | API Gateway + Lambda + Cognito | `docs/architecture/ARCHITECTURE.md` describes the HTTP API backed by `backend/api` Lambda and Cognito JWT auth (lines 40‑58). `infrastructure/lib/stacks/api-stack.ts` wires HttpApi routes, JWT authorizer, and Lambda env vars for Step Functions, S3, and Secrets Manager (lines 68‑188). |
| Workflow orchestration | Step Functions + Lambda | `infrastructure/lib/stacks/compute-stack.ts` provisions the `leadmagnet-job-processor` Lambda, assigns secrets, and builds the Step Functions state machine (lines 30‑164). The definition (`lib/stepfunctions/job-processor-state-machine.ts`) updates DynamoDB job status, resolves dependencies, iterates workflow steps, and runs HTML generation (lines 33‑239). |
| Stateful storage | DynamoDB tables | `infrastructure/lib/stacks/database-stack.ts` creates 15+ tables for workflows, forms, submissions, jobs, artifacts, templates, user settings, notifications, impersonation sessions, etc., each with tenant-scoped GSIs and TTL policies (lines 20‑287). |
| Artifact storage/CDN | S3 + CloudFront | `infrastructure/lib/stacks/storage-stack.ts` provisions the artifacts bucket, lifecycle rules, public image ACLs, and CloudFront distribution that serves generated assets (lines 54‑165). |
| Identity & user lifecycle | Cognito + Lambda triggers | `infrastructure/lib/stacks/auth-stack.ts` defines the user pool, hosted domain, SRP flows, and Lambda triggers that stamp `tenant_id`, `role`, and `customer_id` attributes plus DynamoDB writes (lines 16‑166). |
| Secrets & integrations | Secrets Manager, IAM | API/worker Lambdas read OpenAI + Twilio secrets via environment names (`ENV_VAR_NAMES.OPENAI_SECRET_NAME`, `SECRET_NAMES.*`) and rely on IAM policies from `lambda-helpers.ts`. |
| Monitoring | CloudWatch | Lambda/Step Functions log groups plus alarms in `lib/monitoring/alarms.ts` (not shown) provide metrics, while docs reference CloudWatch dashboards and logs (`docs/architecture/ARCHITECTURE.md`, lines 248‑266). |

---

## 2. Self-Managed Foundations

### Relational Data Store
- **Technology:** PostgreSQL 15 with logical replication enabled.
- **Access Layer:** Prisma inside `backend/api` (Node) and SQLAlchemy inside `backend/worker` (Python) for shared models.
- **Multi-Tenancy:** Every table enforces `tenant_id` (UUID) + `customer_id` columns with Postgres Row-Level Security. Use schemas (`tenant_<id>`) only for heavy isolation workloads; default to shared schema with policy.
- **High Availability:** Start with a two-node Patroni cluster; promote to managed service (e.g., Crunchy) if necessary.
- **Migration Strategy:** Author SQL migrations under `backend/api/prisma/migrations/` that mirror DynamoDB entities (workflows, submissions, jobs, artifacts, templates, notifications, impersonation sessions, etc.).

### Object & Artifact Storage
- **Technology:** MinIO Gateway (erasure-coded) with S3-compatible API on `artifacts` bucket.
- **Layout:** Preserve existing key structure `tenant_id/jobs/{job_id}/...` so worker code paths remain similar.
- **Access:** Introduce `backend/api/src/services/storage.ts` that wraps `@aws-sdk/client-s3` pointing to MinIO credentials; reuse in worker via boto-style client.
- **Distribution:** Serve public artifacts via Nginx (or Traefik) fronting MinIO, with optional Cloudflare CDN if future caching is needed.

### Authentication & Secrets
- **Identity Provider:** Replace Cognito with a self-hosted auth service: Keycloak or Ory Hydra for OAuth2/OIDC + user management. Store tenant/customer metadata in Postgres and sync via event hooks.
- **Session Handling:** `frontend/src/lib/auth.ts` switches to Authorization Code flow against the new IdP; `backend/api` validates JWTs using the IdP's JWKS endpoint.
- **Secrets:** Deploy HashiCorp Vault (or Doppler) to hold OpenAI/Twilio/API keys. `backend/api` gets short-lived tokens via AppRole; worker uses Vault Agent sidecar to render env files.

---

## 3. Queue & Orchestrator Replacement

### Core Components
1. **Redis Stack:** Highly-available Redis (e.g., Redis Stack with persistence) for queues, scheduled jobs, and rate limiting.
2. **BullMQ-based Orchestrator (`backend/orchestrator/`):**
   - Express/Koa service exposing internal endpoints to enqueue jobs, inspect states, and trigger retries.
   - Defines queues:
     - `submission-intake`: receives events from API after DB transaction commits.
     - `workflow-jobs`: main ETL queue with concurrency controls per tenant/model.
     - `delivery-notifications`: handles webhook/SMS send attempts + retries.
   - Implements state transitions: `pending → queued → processing → delivered/failed`, persisting to Postgres via repository layer shared with API.
   - Supports scheduled/recurring jobs using BullMQ repeatables (replacing Step Functions timers/EventBridge).
3. **Backpressure & SLAs:**
   - Use BullMQ rate limiters per queue to throttle AI calls per tenant.
   - Expose `/metrics` for queue depth, processing latency, and failure counts.

### API Integration
- API writes submission, job, and audit rows within a Postgres transaction, then pushes a lightweight payload (`job_id`, `tenant_id`) to `submission-intake`.
- Orchestrator acknowledges the message only after job status is updated to `queued` and dependencies verified (mirrors `ResolveDependencies` Step Functions task).
- Workflow definitions (JSON) are stored in Postgres and cached locally; orchestrator loads them to determine step ordering before handing off to workers.

---

## 4. Worker Pipeline Rework

### Service Model
- Convert `backend/worker` into a continuously running container (Python 3.11) launched via systemd, Docker Compose, or Kubernetes Deployment.
- Add `queue_client.py` that consumes BullMQ streams via `bullmq-broker` (Node) or implement a Redis/BLPOP bridge; ack messages after successful state updates.
- Support horizontal scaling by running multiple worker replicas, each shard assigned via queue concurrency settings.

### Processing Flow
1. **Job Fetch:** Worker pulls `workflow-jobs` message, loads full job/submission/workflow from Postgres via `DataLoaderService` (ported to SQL).
2. **Chunked IO:** For ≤10 GB inputs, stream uploads/downloads using Python's `shutil.copyfileobj` to `/tmp/jobs/{job_id}`, then upload to MinIO via multipart API (boto3/Minio client).
3. **AI Execution:** Reuse `AIService`, but fetch credentials from Vault-injected env files; maintain per-tenant model selection and usage tracking in Postgres.
4. **Artifact Persistence:** Replace DynamoDB `artifact_service` calls with Postgres records + MinIO writes; keep API contract identical.
5. **Failure Handling:** On exceptions, update Postgres job row (`status='failed'`, `error_code`, `retry_count`) and push message to `delivery-notifications` for optional alerting. Dead-letter queue stored in Postgres table `job_failures`.

### Tooling
- Provide CLI (`scripts/workerctl.py`) to pause/resume queues, drain jobs, and tail structured logs.

---

## 5. Artifact Delivery & Notifications

### Webhooks
- Implement `NotificationDispatcher` in orchestrator:
  - Reads webhook definitions from Postgres.
  - Sends HTTPS requests directly (Axios/Requests) with tenant-scoped signing secrets.
  - Persists attempts in `notification_attempts` table with exponential backoff (e.g., 5 retries over 30 minutes).
  - Offers admin UI to replay failed attempts.

### SMS
- Run Twilio SDK directly from orchestrator; credentials pulled from Vault per tenant.
- Add rate limiting by tenant/phone region to avoid abuse; track SMS usage in `usage_records` table (ported from DynamoDB).

### Artifact Access
- API exposes `/artifacts/:id` routes served by Express:
  - Issues signed URLs (JWT-encoded) referencing MinIO object path; expiration configurable (default 7 days).
  - Optionally streams content directly with byte-range support when artifacts remain under 100 MB.
- Public assets (images) delivered through Nginx with caching headers replicating the CloudFront behaviour defined in `storage-stack.ts`.

---

## 6. Observability & Operations

| Layer | Tooling | Notes |
| --- | --- | --- |
| Logs | OpenTelemetry SDK → Fluent Bit → Loki | Structured JSON logs from API, orchestrator, and worker share `trace_id` propagated via queue metadata. |
| Metrics | Prometheus + Grafana | Exporters for Node (api/orchestrator) and Python (worker). Dashboards cover queue depth, job latency, AI token spend, MinIO disk usage, Postgres replication lag. |
| Traces | Tempo/Jaeger | API span creates trace; orchestrator/worker join using incoming `traceparent` from queue payload. |
| Alerts | Alertmanager | Alert on queue backlog, job failure spikes, AI error ratios, vault token expiry, disk usage. |
| Secrets Rotation | Vault | Configure periodic rotation for OpenAI/Twilio via Vault leasing; workers reload via SIGHUP. |
| Backups | pgBackRest for Postgres; MinIO snapshot + rclone to cold storage; Redis AOF nightly copy. |

Operational runbooks should live under `docs/operations/` covering queue recovery, worker redeploy, and Vault outage procedures.

---

## 7. Migration & Rollout

1. **Schema Parity:** Define Prisma migrations reflecting each DynamoDB table (workflows, forms, submissions, jobs, artifacts, templates, notifications, impersonation logs, sessions, folders, files, usage). Include indices to mirror GSIs.
2. **Data Pumps:** Build ETL scripts under `scripts/migrations/`:
   - DynamoDB → Postgres: stream scans with pagination, transform JSON attribute maps, and insert via COPY.
   - S3 → MinIO: use `aws s3 sync` or `rclone` to copy `tenant_id/jobs/...` prefixes; verify checksums.
3. **Dual Write/Read:** Update API Lambda (or temporary bridge) to write to both DynamoDB and Postgres while still reading from DynamoDB to validate completeness.
4. **Shadow Queue:** Run orchestrator + worker against Postgres data but mark outputs as non-production; compare artifact diffs against Lambda results.
5. **Cutover:** Flip API to hit self-hosted stack, disable Step Functions triggers, and route form submissions to new API endpoint. Keep AWS path in read-only mode for rollback.
6. **Decommission:** After 2+ weeks of clean metrics, delete AWS resources via CDK destroy, archive CloudWatch logs, and update billing.
7. **Documentation:** Update `docs/architecture/ARCHITECTURE.md`, deployment guides, and runbooks to treat the in-app stack as the primary architecture.

---

## Open Questions & Risks
- **Capacity Planning:** Determine whether single-node Redis/Postgres suffices or if clustering is needed immediately.
- **Compliance:** Evaluate data residency requirements now that Cognito/S3 encryption defaults disappear.
- **Cost Envelope:** Budget for 24/7 hosts, Vault, monitoring stack, and backups versus pay-per-use AWS costs.

---

_Last updated: 2025-11-19_

