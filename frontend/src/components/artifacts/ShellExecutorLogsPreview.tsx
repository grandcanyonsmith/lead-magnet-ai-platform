interface ShellExecutorOutcome {
  type?: string;
  exit_code?: number;
  message?: string;
}

interface ShellExecutorOutputItem {
  stdout?: string;
  stderr?: string;
  outcome?: ShellExecutorOutcome;
}

interface ShellExecutorCallLog {
  call_id?: string;
  commands?: string[];
  timeout_ms?: number;
  max_output_length?: number;
  output?: ShellExecutorOutputItem[];
  meta?: {
    runner?: string;
    duration_ms?: number;
  };
  workspace_id?: string;
  reset_workspace?: boolean;
  timestamp?: number;
}

export interface ShellExecutorLogsPayload {
  job_id?: string;
  tenant_id?: string;
  step_index?: number;
  step_order?: number;
  step_name?: string;
  model?: string;
  logs?: ShellExecutorCallLog[];
}

export type ShellExecutorLogsPreviewVariant = "compact" | "default";

export const isShellExecutorLogsPayload = (
  value: unknown,
): value is ShellExecutorLogsPayload => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.logs)) return false;
  if (record.job_id && typeof record.job_id !== "string") return false;
  const hasStepMeta =
    typeof record.step_name === "string" ||
    typeof record.step_order === "number" ||
    typeof record.step_index === "number" ||
    typeof record.job_id === "string";
  if (!hasStepMeta) return false;
  if (record.logs.length === 0) return true;
  return record.logs.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const entryRecord = entry as Record<string, unknown>;
    return Array.isArray(entryRecord.commands) || Array.isArray(entryRecord.output);
  });
};

const formatDuration = (durationMs?: number) => {
  if (durationMs === undefined || durationMs === null) return null;
  if (durationMs < 1000) return `${durationMs}ms`;
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}m ${remaining}s`;
};

const formatTimestamp = (timestamp?: number) => {
  if (!timestamp) return null;
  const asMs = timestamp > 1e12 ? timestamp : timestamp * 1000;
  return new Date(asMs).toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const formatOutcome = (outcome?: ShellExecutorOutcome) => {
  if (!outcome) return null;
  if (outcome.type === "exit") {
    return `exit ${outcome.exit_code ?? 0}`;
  }
  if (outcome.type) return outcome.type;
  return null;
};

const getStepLabel = (payload: ShellExecutorLogsPayload) => {
  if (payload.step_order !== undefined) {
    const nameSuffix = payload.step_name ? ` · ${payload.step_name}` : "";
    return `Step ${payload.step_order}${nameSuffix}`;
  }
  return payload.step_name || "Executor logs";
};

const getExecutorLabel = (payload: ShellExecutorLogsPayload) => {
  const runner = payload.logs?.[0]?.meta?.runner?.toLowerCase() || "";
  if (runner.includes("code")) return "Code executor logs";
  if (runner.includes("shell")) return "Shell executor logs";
  return "Executor logs";
};

export function ShellExecutorLogsPreview({
  payload,
  variant = "default",
}: {
  payload: ShellExecutorLogsPayload;
  variant?: ShellExecutorLogsPreviewVariant;
}) {
  const logs = Array.isArray(payload.logs) ? payload.logs : [];
  const stepLabel = getStepLabel(payload);
  const executorLabel = getExecutorLabel(payload);
  const isCompact = variant === "compact";

  return (
    <div
      className={`h-full w-full overflow-y-auto rounded-md bg-[#0d1117] text-xs text-slate-200 ${
        isCompact ? "scrollbar-hide-until-hover" : ""
      }`}
    >
      <div
        className={`sticky top-0 z-10 border-b border-white/10 bg-[#161b22] ${
          isCompact ? "px-3 py-2" : "px-4 py-3"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-300">
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-100">
            {executorLabel}
          </span>
          <span className="text-[11px] font-semibold text-slate-100">
            {stepLabel}
          </span>
          {payload.model && (
            <span className="rounded-full bg-white/10 px-2 py-0.5">
              {payload.model}
            </span>
          )}
          {payload.job_id && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono">
              {payload.job_id}
            </span>
          )}
          <span className="rounded-full bg-white/10 px-2 py-0.5">
            {logs.length} call{logs.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="px-4 py-10 text-center text-[11px] text-slate-400">
          No {executorLabel.toLowerCase()} recorded for this step.
        </div>
      ) : (
        <div className={`space-y-4 ${isCompact ? "px-3 py-3" : "px-4 py-4"}`}>
          {logs.map((log, logIndex) => {
            const commands = log.commands ?? [];
            const outputs = log.output ?? [];
            const durationLabel = formatDuration(log.meta?.duration_ms);
            const timestampLabel = formatTimestamp(log.timestamp);

            return (
              <div
                key={`${log.call_id || "call"}-${logIndex}`}
                className="rounded-md border border-white/10 bg-black/30"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-[10px] text-slate-400">
                  <div className="font-semibold text-slate-200">
                    Call {logIndex + 1}
                  </div>
                  {log.call_id && (
                    <div className="font-mono">{log.call_id}</div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 px-3 py-2 text-[10px] text-slate-400">
                  {log.meta?.runner && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5">
                      {log.meta.runner}
                    </span>
                  )}
                  {durationLabel && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5">
                      {durationLabel}
                    </span>
                  )}
                  {timestampLabel && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5">
                      {timestampLabel}
                    </span>
                  )}
                  {log.timeout_ms && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5">
                      timeout {log.timeout_ms}ms
                    </span>
                  )}
                  {log.max_output_length && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5">
                      max output {log.max_output_length}
                    </span>
                  )}
                  {log.workspace_id && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono">
                      {log.workspace_id}
                    </span>
                  )}
                  {log.reset_workspace !== undefined && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5">
                      reset workspace: {log.reset_workspace ? "yes" : "no"}
                    </span>
                  )}
                </div>

                <div className="space-y-3 px-3 pb-3">
                  {commands.length === 0 ? (
                    <div className="rounded-md border border-white/10 bg-black/40 px-3 py-3 text-[10px] text-slate-400">
                      No commands recorded for this call.
                    </div>
                  ) : (
                    commands.map((command, commandIndex) => {
                      const output = outputs[commandIndex];
                      const hasStdout = Boolean(output?.stdout?.trim());
                      const hasStderr = Boolean(output?.stderr?.trim());
                      const outcomeLabel = formatOutcome(output?.outcome);
                      const isErrorExit =
                        output?.outcome?.type === "exit" &&
                        typeof output?.outcome?.exit_code === "number" &&
                        output?.outcome?.exit_code !== 0;

                      return (
                        <div
                          key={`${log.call_id || logIndex}-${commandIndex}`}
                          className="rounded-md border border-white/10 bg-black/40"
                        >
                          <div className="flex items-start gap-2 px-3 py-2 text-[11px] text-slate-100">
                            <span className="text-slate-500">$</span>
                            <code className="break-all">{command}</code>
                          </div>

                          {outcomeLabel && (
                            <div className="border-t border-white/10 px-3 py-1.5 text-[10px] text-slate-400">
                              Outcome:{" "}
                              <span
                                className={`rounded-full px-2 py-0.5 ${
                                  isErrorExit
                                    ? "bg-rose-500/20 text-rose-200"
                                    : "bg-emerald-500/20 text-emerald-200"
                                }`}
                              >
                                {outcomeLabel}
                              </span>
                            </div>
                          )}

                          {hasStdout && (
                            <div className="border-t border-white/10">
                              <div className="px-3 pt-2 text-[10px] uppercase tracking-wide text-emerald-300">
                                stdout
                              </div>
                              <pre className="px-3 pb-2 whitespace-pre-wrap break-words text-[11px] text-slate-100">
                                {output?.stdout}
                              </pre>
                            </div>
                          )}

                          {hasStderr && (
                            <div className="border-t border-white/10">
                              <div className="px-3 pt-2 text-[10px] uppercase tracking-wide text-rose-300">
                                stderr
                              </div>
                              <pre className="px-3 pb-2 whitespace-pre-wrap break-words text-[11px] text-rose-100">
                                {output?.stderr}
                              </pre>
                            </div>
                          )}

                          {!hasStdout && !hasStderr && !outcomeLabel && (
                            <div className="border-t border-white/10 px-3 py-2 text-[10px] text-slate-500">
                              No output captured for this command.
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
