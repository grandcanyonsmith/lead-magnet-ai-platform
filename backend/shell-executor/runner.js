/**
 * Shell Executor Runner (ECS Fargate task)
 *
 * Reads a ShellExecutorJobRequest from env, executes commands, then uploads a
 * ShellExecutorJobResult JSON to the provided presigned S3 PUT URL.
 *
 * Contract version is pinned to the API's `SHELL_EXECUTOR_CONTRACT_VERSION`.
 *
 * Security posture note:
 * - This is intentionally capable of running free-form shell commands.
 * - Safety MUST be enforced by infrastructure controls (no task role creds,
 *   isolated networking, rate limits, WAF, quotas, etc.).
 */

const { spawn } = require('child_process');
const fs = require('fs');

const CONTRACT_VERSION = '2025-12-18';

function nowIso() {
  return new Date().toISOString();
}

function clampInt(value, { min, max, fallback }) {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function getEnv(name) {
  const v = process.env[name];
  return typeof v === 'string' ? v : undefined;
}

function readJobRequest() {
  const b64 = getEnv('SHELL_EXECUTOR_JOB_B64');
  const json = getEnv('SHELL_EXECUTOR_JOB_JSON');

  let payloadStr;
  if (b64 && b64.trim().length > 0) {
    payloadStr = Buffer.from(b64, 'base64').toString('utf8');
  } else if (json && json.trim().length > 0) {
    payloadStr = json;
  } else {
    throw new Error('Missing SHELL_EXECUTOR_JOB_B64 or SHELL_EXECUTOR_JOB_JSON');
  }

  let payload;
  try {
    payload = JSON.parse(payloadStr);
  } catch (err) {
    throw new Error(`Invalid job JSON: ${(err && err.message) || String(err)}`);
  }

  // Minimal validation (keep deps at zero).
  if (!payload || typeof payload !== 'object') throw new Error('Job payload must be an object');
  if (payload.version !== CONTRACT_VERSION) throw new Error(`Unsupported contract version: ${payload.version}`);
  if (!payload.job_id || typeof payload.job_id !== 'string') throw new Error('job_id is required');
  if (!Array.isArray(payload.commands) || payload.commands.length === 0) throw new Error('commands[] is required');
  if (typeof payload.result_put_url !== 'string' || payload.result_put_url.length === 0) throw new Error('result_put_url is required');
  if (payload.timeout_ms !== undefined && (!Number.isFinite(payload.timeout_ms) || payload.timeout_ms <= 0)) {
    throw new Error('timeout_ms must be a positive number if provided');
  }
  if (payload.max_output_length !== undefined && (!Number.isFinite(payload.max_output_length) || payload.max_output_length <= 0)) {
    throw new Error('max_output_length must be a positive number if provided');
  }

  return payload;
}

function ensureWorkspace() {
  const dir = '/workspace';
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // ignore
  }
  return dir;
}

function maybeLinkAwsConfig(workspaceDir) {
  // Developer convenience: when running the executor locally, you can mount your host
  // AWS config dir into /home/runner/.aws. The executor runs commands with HOME=/workspace,
  // so we symlink /workspace/.aws -> /home/runner/.aws when present.
  try {
    const src = '/home/runner/.aws';
    const dst = `${workspaceDir}/.aws`;
    if (!fs.existsSync(dst) && fs.existsSync(src)) {
      fs.symlinkSync(src, dst, 'dir');
    }
  } catch {
    // ignore (best-effort)
  }
}

function collectLimited(stream, maxBytes) {
  let bufs = [];
  let size = 0;
  let truncated = false;

  stream.on('data', (chunk) => {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    if (size >= maxBytes) {
      truncated = true;
      return;
    }
    const remaining = maxBytes - size;
    if (buf.length <= remaining) {
      bufs.push(buf);
      size += buf.length;
      return;
    }
    bufs.push(buf.subarray(0, remaining));
    size += remaining;
    truncated = true;
  });

  return {
    toString: () => Buffer.concat(bufs).toString('utf8'),
    isTruncated: () => truncated,
  };
}

async function runCommand(command, opts) {
  const { timeoutMs, cwd, maxStdoutBytes, maxStderrBytes } = opts;

  return await new Promise((resolve) => {
    const child = spawn('/bin/bash', ['-lc', command], {
      cwd,
      env: {
        // Clean environment: only pass a minimal PATH and a stable HOME.
        PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        HOME: cwd,
        LANG: 'C.UTF-8',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdoutCollector = collectLimited(child.stdout, maxStdoutBytes);
    const stderrCollector = collectLimited(child.stderr, maxStderrBytes);

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);

      const stdout = stdoutCollector.toString();
      const stderrRaw = stderrCollector.toString();
      const truncNote = [];
      if (stdoutCollector.isTruncated()) truncNote.push('[stdout truncated]');
      if (stderrCollector.isTruncated()) truncNote.push('[stderr truncated]');

      const stderr = truncNote.length > 0 ? `${stderrRaw}\n${truncNote.join(' ')}`.trim() : stderrRaw;

      if (timedOut) {
        resolve({
          stdout,
          stderr,
          outcome: { type: 'timeout' },
        });
        return;
      }

      resolve({
        stdout,
        stderr,
        outcome: { type: 'exit', exit_code: Number.isFinite(code) ? code : 1 },
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        stdout: '',
        stderr: `Failed to start command: ${(err && err.message) || String(err)}`,
        outcome: { type: 'exit', exit_code: 1 },
      });
    });
  });
}

async function uploadJson(url, jsonStr, contentType) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'content-type': contentType || 'application/json',
    },
    body: jsonStr,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to upload result: HTTP ${res.status} ${res.statusText} ${text}`.trim());
  }
}

async function main() {
  const job = readJobRequest();
  const cwd = ensureWorkspace();
  maybeLinkAwsConfig(cwd);

  const perCommandTimeoutMs = clampInt(job.timeout_ms || getEnv('SHELL_EXECUTOR_TIMEOUT_MS'), {
    min: 1_000,
    // NOTE: Keep in mind the caller (often Lambda) may have a shorter timeout.
    // This cap is for the executor task itself.
    max: 20 * 60 * 1000,
    fallback: 1_200_000,
  });

  // Keep these bounded to prevent memory blowups in the runner.
  const maxStdoutBytes = clampInt(getEnv('SHELL_EXECUTOR_MAX_STDOUT_BYTES'), {
    min: 1_024,
    max: 10 * 1024 * 1024,
    fallback: 10 * 1024 * 1024,
  });
  const maxStderrBytes = clampInt(getEnv('SHELL_EXECUTOR_MAX_STDERR_BYTES'), {
    min: 1_024,
    max: 10 * 1024 * 1024,
    fallback: 10 * 1024 * 1024,
  });

  const startedAt = nowIso();
  const t0 = Date.now();

  const output = [];
  for (const cmd of job.commands) {
    // Execute sequentially to keep resource usage predictable.
    // If you ever need parallelism, move this to a bounded worker pool.
    // eslint-disable-next-line no-await-in-loop
    const result = await runCommand(String(cmd), {
      timeoutMs: perCommandTimeoutMs,
      cwd,
      maxStdoutBytes,
      maxStderrBytes,
    });
    output.push(result);
  }

  const finishedAt = nowIso();
  const durationMs = Date.now() - t0;

  const result = {
    version: CONTRACT_VERSION,
    job_id: job.job_id,
    commands: job.commands,
    max_output_length: job.max_output_length,
    output,
    meta: {
      started_at: startedAt,
      finished_at: finishedAt,
      duration_ms: durationMs,
      runner: 'shell-executor/node',
    },
  };

  const jsonStr = JSON.stringify(result);
  await uploadJson(job.result_put_url, jsonStr, job.result_content_type || 'application/json');

  // Helpful for CloudWatch logs, but keep it small.
  process.stdout.write(
    JSON.stringify({
      msg: 'shell-executor completed',
      job_id: job.job_id,
      commands: Array.isArray(job.commands) ? job.commands.length : 0,
      duration_ms: durationMs,
    }) + '\n'
  );
}

main().catch((err) => {
  const message = (err && err.message) || String(err);
  process.stderr.write(`shell-executor failed: ${message}\n`);
  process.exitCode = 1;
});


