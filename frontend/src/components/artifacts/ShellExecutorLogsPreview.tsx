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

const collectCommands = (logs: ShellExecutorCallLog[]) =>
  logs.flatMap((log) => log.commands ?? []);

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
  const totalCommands = collectCommands(logs).length;
  const totalDurationMs = logs.reduce(
    (sum, log) => sum + (log.meta?.duration_ms ?? 0),
    0,
  );
  const sampleCommands = collectCommands(logs).slice(0, 2);

  if (variant === "compact") {
    return (
      <div className="flex h-full w-full flex-col justify-between p-3 text-[11px]">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {executorLabel}
          </div>
          <div className="mt-1 text-xs font-medium text-foreground line-clamp-2">
            {stepLabel}
          </div>
          {payload.model && (
            <div className="text-[10px] text-muted-foreground">{payload.model}</div>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5">
            {logs.length} call{logs.length === 1 ? "" : "s"}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5">
            {totalCommands} cmd{totalCommands === 1 ? "" : "s"}
          </span>
          {logs[0]?.meta?.runner && (
            <span className="rounded-full bg-muted px-2 py-0.5">
              {logs[0]?.meta?.runner}
            </span>
          )}
          {totalDurationMs > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5">
              {formatDuration(totalDurationMs)}
            </span>
          )}
        </div>
        {sampleCommands.length > 0 && (
          <ul className="mt-2 space-y-1 text-[10px] font-mono text-muted-foreground">
            {sampleCommands.map((command, index) => (
              <li key={`${command}-${index}`} className="line-clamp-1">
                {command}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-background p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px] font-semibold text-foreground">
          {executorLabel}
        </span>
        <span className="text-[11px] font-medium text-foreground">{stepLabel}</span>
        {payload.model && (
          <span className="rounded-full border border-border/70 bg-muted/50 px-2 py-0.5">
            {payload.model}
          </span>
        )}
        {payload.job_id && (
          <span className="rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 font-mono">
            {payload.job_id}
          </span>
        )}
        <span className="rounded-full border border-border/70 bg-muted/50 px-2 py-0.5">
          {logs.length} call{logs.length === 1 ? "" : "s"}
        </span>
      </div>

      {logs.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border/70 bg-muted/40 px-4 py-6 text-center text-xs text-muted-foreground">
          No {executorLabel.toLowerCase()} recorded for this step.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {logs.map((log, logIndex) => {
            const commands = log.commands ?? [];
            const outputs = log.output ?? [];
            const durationLabel = formatDuration(log.meta?.duration_ms);
            const timestampLabel = formatTimestamp(log.timestamp);

            return (
              <div
                key={`${log.call_id || "call"}-${logIndex}`}
                className="rounded-lg border border-border/70 bg-muted/20"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                  <div className="text-xs font-semibold text-foreground">
                    Call {logIndex + 1}
                  </div>
                  {log.call_id && (
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {log.call_id}
                    </div>
                  )}
                </div>
                <div className="space-y-3 px-3 py-3 text-xs text-muted-foreground">
                  <div className="flex flex-wrap gap-2">
                    {log.meta?.runner && (
                      <span className="rounded-full border border-border/70 bg-background/80 px-2 py-0.5">
                        {log.meta.runner}
                      </span>
                    )}
                    {durationLabel && (
                      <span className="rounded-full border border-border/70 bg-background/80 px-2 py-0.5">
                        {durationLabel}
                      </span>
                    )}
                    {timestampLabel && (
                      <span className="rounded-full border border-border/70 bg-background/80 px-2 py-0.5">
                        {timestampLabel}
                      </span>
                    )}
                    {log.timeout_ms && (
                      <span className="rounded-full border border-border/70 bg-background/80 px-2 py-0.5">
                        timeout {log.timeout_ms}ms
                      </span>
                    )}
                    {log.max_output_length && (
                      <span className="rounded-full border border-border/70 bg-background/80 px-2 py-0.5">
                        max output {log.max_output_length}
                      </span>
                    )}
                    {log.workspace_id && (
                      <span className="rounded-full border border-border/70 bg-background/80 px-2 py-0.5 font-mono">
                        {log.workspace_id}
                      </span>
                    )}
                    {log.reset_workspace !== undefined && (
                      <span className="rounded-full border border-border/70 bg-background/80 px-2 py-0.5">
                        reset workspace: {log.reset_workspace ? "yes" : "no"}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {commands.length === 0 ? (
                      <div className="rounded-md border border-dashed border-border/70 bg-background/60 px-3 py-3 text-center text-[11px] text-muted-foreground">
                        No commands recorded for this call.
                      </div>
                    ) : (
                      commands.map((command, commandIndex) => {
                        const output = outputs[commandIndex];
                        const hasStdout = Boolean(output?.stdout?.trim());
                        const hasStderr = Boolean(output?.stderr?.trim());
                        const outcomeLabel = formatOutcome(output?.outcome);

                        return (
                          <div
                            key={`${log.call_id || logIndex}-${commandIndex}`}
                            className="rounded-md border border-border/60 bg-background/60 p-2"
                          >
                            <div className="flex items-start gap-2 text-[11px]">
                              <span className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                                #{commandIndex + 1}
                              </span>
                              <code className="break-all font-mono text-foreground">
                                {command}
                              </code>
                            </div>

                            {(hasStdout || hasStderr || outcomeLabel) && (
                              <div className="mt-2 space-y-2 text-[11px]">
                                {outcomeLabel && (
                                  <div className="text-[10px] font-semibold text-muted-foreground">
                                    Outcome:{" "}
                                    <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-foreground">
                                      {outcomeLabel}
                                    </span>
                                  </div>
                                )}
                                {hasStdout && (
                                  <div>
                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                                      stdout
                                    </div>
                                    <pre className="mt-1 whitespace-pre-wrap break-words rounded-md bg-emerald-50/60 p-2 text-[11px] text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100">
                                      {output?.stdout}
                                    </pre>
                                  </div>
                                )}
                                {hasStderr && (
                                  <div>
                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-rose-600">
                                      stderr
                                    </div>
                                    <pre className="mt-1 whitespace-pre-wrap break-words rounded-md bg-rose-50/60 p-2 text-[11px] text-rose-900 dark:bg-rose-500/10 dark:text-rose-100">
                                      {output?.stderr}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
