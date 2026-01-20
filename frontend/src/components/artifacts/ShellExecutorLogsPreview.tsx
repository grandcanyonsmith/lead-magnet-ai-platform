import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";

const LARGE_COMMAND_THRESHOLD = 12;
const LARGE_CALL_THRESHOLD = 4;
const MAX_OUTPUT_PREVIEW_LINES = 14;
const MAX_OUTPUT_PREVIEW_CHARS = 1200;

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

interface FilteredCommandEntry {
  command: string;
  output?: ShellExecutorOutputItem;
  outcomeLabel: string | null;
  isError: boolean;
  matches: boolean;
  index: number;
}

interface FilteredLogEntry {
  log: ShellExecutorCallLog;
  logIndex: number;
  commands: FilteredCommandEntry[];
  totalCommands: number;
  errorCount: number;
  matchedCount: number;
}

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

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlightMatches = (text: string, query: string) => {
  if (!query) return text;
  const escaped = escapeRegExp(query);
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  const lowerQuery = query.toLowerCase();
  return parts.map((part, index) =>
    part.toLowerCase() === lowerQuery ? (
      <mark
        key={`match-${index}`}
        className="rounded bg-amber-400/30 px-0.5 text-amber-100"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
};

const isErrorOutput = (output?: ShellExecutorOutputItem) => {
  if (!output) return false;
  const exitCode = output.outcome?.exit_code;
  const isExitError =
    output.outcome?.type === "exit" &&
    typeof exitCode === "number" &&
    exitCode !== 0;
  const hasStderr = Boolean(output.stderr?.trim());
  return isExitError || hasStderr;
};

const matchesSearch = (
  queryLower: string,
  ...values: Array<string | null | undefined>
) => {
  if (!queryLower) return true;
  return values.some((value) => value?.toLowerCase().includes(queryLower));
};

const getOutputPreview = (value: string) => {
  const normalized = value.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const truncatedByLines = lines.length > MAX_OUTPUT_PREVIEW_LINES;
  const linePreview = truncatedByLines
    ? lines.slice(0, MAX_OUTPUT_PREVIEW_LINES).join("\n")
    : normalized;
  const truncatedByChars = linePreview.length > MAX_OUTPUT_PREVIEW_CHARS;
  const preview = truncatedByChars
    ? linePreview.slice(0, MAX_OUTPUT_PREVIEW_CHARS)
    : linePreview;
  return {
    preview,
    isTruncated: truncatedByLines || truncatedByChars,
    totalLines: lines.length,
  };
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

const formatLogsAsText = (payload: ShellExecutorLogsPayload) => {
  const logs = Array.isArray(payload.logs) ? payload.logs : [];
  const lines: string[] = [];

  lines.push(`${getExecutorLabel(payload)} - ${getStepLabel(payload)}`);
  if (payload.model) lines.push(`Model: ${payload.model}`);
  if (payload.job_id) lines.push(`Job: ${payload.job_id}`);
  lines.push("");

  logs.forEach((log, logIndex) => {
    const callIdSuffix = log.call_id ? ` (${log.call_id})` : "";
    lines.push(`Call ${logIndex + 1}${callIdSuffix}`);
    const metaParts: string[] = [];
    if (log.meta?.runner) metaParts.push(`runner=${log.meta.runner}`);
    const durationLabel = formatDuration(log.meta?.duration_ms);
    if (durationLabel) metaParts.push(`duration=${durationLabel}`);
    const timestampLabel = formatTimestamp(log.timestamp);
    if (timestampLabel) metaParts.push(`timestamp=${timestampLabel}`);
    if (log.timeout_ms) metaParts.push(`timeout=${log.timeout_ms}ms`);
    if (log.max_output_length) metaParts.push(`max_output=${log.max_output_length}`);
    if (log.workspace_id) metaParts.push(`workspace=${log.workspace_id}`);
    if (log.reset_workspace !== undefined) {
      metaParts.push(`reset_workspace=${log.reset_workspace ? "yes" : "no"}`);
    }
    if (metaParts.length > 0) lines.push(`Meta: ${metaParts.join(", ")}`);

    const commands = log.commands ?? [];
    const outputs = log.output ?? [];
    if (commands.length === 0) {
      lines.push("No commands recorded.");
      lines.push("");
      return;
    }

    commands.forEach((command, index) => {
      lines.push(`$ ${command}`);
      const output = outputs[index];
      const outcomeLabel = formatOutcome(output?.outcome);
      if (outcomeLabel) lines.push(`Outcome: ${outcomeLabel}`);
      if (output?.stdout) lines.push(`stdout:\n${output.stdout}`);
      if (output?.stderr) lines.push(`stderr:\n${output.stderr}`);
      lines.push("");
    });
  });

  return lines.join("\n");
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

  const totalCommands = logs.reduce(
    (sum, log) => sum + (log.commands?.length ?? 0),
    0,
  );
  const totalCalls = logs.length;
  const isLarge =
    totalCommands > LARGE_COMMAND_THRESHOLD || totalCalls > LARGE_CALL_THRESHOLD;

  const [searchQuery, setSearchQuery] = useState("");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [showStdout, setShowStdout] = useState(true);
  const [showStderr, setShowStderr] = useState(true);
  const [expandAll, setExpandAll] = useState(() => !isLarge);
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedOutputs, setExpandedOutputs] = useState<Set<string>>(
    () => new Set(),
  );

  const trimmedQuery = searchQuery.trim();
  const queryLower = trimmedQuery.toLowerCase();
  const hasQuery = trimmedQuery.length > 0;
  const hasFilters = hasQuery || errorsOnly;

  const { filteredLogs, matchedCommands, matchedCalls } = useMemo(() => {
    const filtered: FilteredLogEntry[] = [];
    let matched = 0;

    logs.forEach((log, logIndex) => {
      const commands = log.commands ?? [];
      const outputs = log.output ?? [];
      const commandEntries = commands.map((command, index) => {
        const output = outputs[index];
        const outcomeLabel = formatOutcome(output?.outcome);
        const isError = isErrorOutput(output);
        const matches =
          matchesSearch(
            queryLower,
            command,
            output?.stdout,
            output?.stderr,
            outcomeLabel ?? undefined,
          ) && (!errorsOnly || isError);

        return {
          command,
          output,
          outcomeLabel,
          isError,
          matches,
          index,
        };
      });

      const visibleCommands =
        hasQuery || errorsOnly
          ? commandEntries.filter((entry) => entry.matches)
          : commandEntries;

      if ((hasQuery || errorsOnly) && visibleCommands.length === 0) {
        return;
      }

      const errorCount = commandEntries.filter((entry) => entry.isError).length;
      const matchedCount = visibleCommands.length;
      matched += matchedCount;

      filtered.push({
        log,
        logIndex,
        commands: visibleCommands,
        totalCommands: commandEntries.length,
        errorCount,
        matchedCount,
      });
    });

    return {
      filteredLogs: filtered,
      matchedCommands: matched,
      matchedCalls: filtered.length,
    };
  }, [logs, errorsOnly, hasQuery, queryLower]);

  const toggleExpandedCall = useCallback((callKey: string) => {
    setExpandedCalls((prev) => {
      const next = new Set(prev);
      if (next.has(callKey)) {
        next.delete(callKey);
      } else {
        next.add(callKey);
      }
      return next;
    });
  }, []);

  const toggleExpandedOutput = useCallback((outputKey: string) => {
    setExpandedOutputs((prev) => {
      const next = new Set(prev);
      if (next.has(outputKey)) {
        next.delete(outputKey);
      } else {
        next.add(outputKey);
      }
      return next;
    });
  }, []);

  const handleCopyText = useCallback(async (value: string, label: string) => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        throw new Error("Clipboard API not available");
      }
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}`);
    }
  }, []);

  const handleCopyAll = useCallback(() => {
    const allText = formatLogsAsText(payload);
    void handleCopyText(allText, "Logs");
  }, [payload, handleCopyText]);

  const handleDownloadJson = useCallback(() => {
    const data = JSON.stringify(payload, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeStep = stepLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    link.href = url;
    link.download = `${safeStep || "executor-logs"}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, [payload, stepLabel]);

  const toggleClass = (active: boolean, activeClasses: string) =>
    `inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 ${
      active
        ? activeClasses
        : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
    }`;

  const actionButtonClass =
    "inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60";

  const resultsLabel = hasFilters
    ? `Showing ${matchedCalls}/${totalCalls} calls · ${matchedCommands}/${totalCommands} commands`
    : `${totalCalls} call${totalCalls === 1 ? "" : "s"} · ${totalCommands} command${
        totalCommands === 1 ? "" : "s"
      }`;

  const renderOutputSection = (
    label: "stdout" | "stderr",
    value: string,
    outputKey: string,
    headerClass: string,
    textClass: string,
  ) => {
    const { preview, isTruncated } = getOutputPreview(value);
    const isExpanded = expandedOutputs.has(outputKey);
    const displayValue = isExpanded ? value : preview;
    const displayContent = hasQuery
      ? highlightMatches(displayValue, trimmedQuery)
      : displayValue;

    return (
      <div className="border-t border-white/10">
        <div
          className={`flex items-center justify-between px-3 pt-2 text-[10px] uppercase tracking-wide ${headerClass}`}
        >
          <div className="flex items-center gap-2">
            <span>{label}</span>
            {isTruncated && !isExpanded && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-slate-400">
                truncated
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleCopyText(value, label)}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
              aria-label={`Copy ${label}`}
            >
              Copy
            </button>
            {isTruncated && (
              <button
                type="button"
                onClick={() => toggleExpandedOutput(outputKey)}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${label}`}
              >
                {isExpanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        </div>
        <pre
          className={`px-3 pb-2 whitespace-pre-wrap break-words text-[11px] ${textClass}`}
        >
          {displayContent}
        </pre>
      </div>
    );
  };

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
        <div
          className={`mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-300 ${
            isCompact ? "" : ""
          }`}
        >
          <label className="flex items-center">
            <span className="sr-only">Search logs</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search commands, output, outcome"
              className="h-7 w-48 rounded-md border border-white/10 bg-black/30 px-2 text-[10px] text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
            />
          </label>
          <button
            type="button"
            onClick={() => setErrorsOnly((prev) => !prev)}
            aria-pressed={errorsOnly}
            className={toggleClass(
              errorsOnly,
              "border-rose-400/30 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30",
            )}
          >
            Errors only
          </button>
          <button
            type="button"
            onClick={() => setShowStdout((prev) => !prev)}
            aria-pressed={showStdout}
            className={toggleClass(
              showStdout,
              "border-emerald-400/30 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30",
            )}
          >
            Stdout
          </button>
          <button
            type="button"
            onClick={() => setShowStderr((prev) => !prev)}
            aria-pressed={showStderr}
            className={toggleClass(
              showStderr,
              "border-amber-400/30 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30",
            )}
          >
            Stderr
          </button>
          <button
            type="button"
            onClick={() => {
              setExpandAll((prev) => !prev);
              setExpandedCalls(new Set());
            }}
            aria-pressed={expandAll}
            className={toggleClass(
              expandAll,
              "border-sky-400/30 bg-sky-500/20 text-sky-200 hover:bg-sky-500/30",
            )}
          >
            Expand all
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
            <span>{resultsLabel}</span>
            <button type="button" onClick={handleCopyAll} className={actionButtonClass}>
              Copy all
            </button>
            <button
              type="button"
              onClick={handleDownloadJson}
              className={actionButtonClass}
            >
              Download JSON
            </button>
          </div>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="px-4 py-10 text-center text-[11px] text-slate-400">
          No {executorLabel.toLowerCase()} recorded for this step.
        </div>
      ) : (
        <div className={`space-y-4 ${isCompact ? "px-3 py-3" : "px-4 py-4"}`}>
          {filteredLogs.length === 0 ? (
            <div className="rounded-md border border-white/10 bg-black/30 px-4 py-6 text-center text-[11px] text-slate-400">
              No matching commands. Try clearing the filters.
            </div>
          ) : (
            filteredLogs.map((entry) => {
              const { log, logIndex, commands, totalCommands: callTotal } = entry;
              const durationLabel = formatDuration(log.meta?.duration_ms);
              const timestampLabel = formatTimestamp(log.timestamp);
              const callKey = log.call_id ? `call-${log.call_id}` : `call-${logIndex}`;
              const isExpanded = expandAll || expandedCalls.has(callKey);
              const commandLabel = callTotal === 1 ? "command" : "commands";
              const commandCountLabel = hasFilters
                ? `${entry.matchedCount}/${callTotal} ${commandLabel}`
                : `${callTotal} ${commandLabel}`;

              const handleCallToggle = () => {
                if (expandAll) {
                  setExpandAll(false);
                  setExpandedCalls(new Set([callKey]));
                  return;
                }
                toggleExpandedCall(callKey);
              };

              return (
                <div
                  key={`${log.call_id || "call"}-${logIndex}`}
                  className="rounded-md border border-white/10 bg-black/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-[10px] text-slate-400">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCallToggle}
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? "Collapse" : "Expand"} call ${logIndex + 1}`}
                        className="inline-flex items-center gap-2 text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
                      >
                        <span className="text-slate-400">
                          {isExpanded ? "▾" : "▸"}
                        </span>
                        <span className="font-semibold">Call {logIndex + 1}</span>
                      </button>
                      <span className="rounded-full bg-white/5 px-2 py-0.5">
                        {commandCountLabel}
                      </span>
                      {entry.errorCount > 0 && (
                        <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-rose-200">
                          {entry.errorCount} error{entry.errorCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    {log.call_id && <div className="font-mono">{log.call_id}</div>}
                  </div>
                  <div className="flex flex-wrap gap-2 border-b border-white/10 px-3 py-2 text-[10px] text-slate-400">
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

                  {isExpanded ? (
                    <div className="space-y-3 px-3 pb-3 pt-3">
                      {commands.length === 0 ? (
                        <div className="rounded-md border border-white/10 bg-black/40 px-3 py-3 text-[10px] text-slate-400">
                          No commands recorded for this call.
                        </div>
                      ) : (
                        commands.map((entryCommand) => {
                          const output = entryCommand.output;
                          const hasStdout = Boolean(output?.stdout?.trim());
                          const hasStderr = Boolean(output?.stderr?.trim());
                          const outputsHidden = !showStdout && !showStderr;
                          const outcomeLabel = entryCommand.outcomeLabel;
                          const isErrorExit =
                            output?.outcome?.type === "exit" &&
                            typeof output?.outcome?.exit_code === "number" &&
                            output?.outcome?.exit_code !== 0;
                          const commandKey = `${callKey}-${entryCommand.index}`;
                          const commandDisplay = hasQuery
                            ? highlightMatches(entryCommand.command, trimmedQuery)
                            : entryCommand.command;

                          return (
                            <div
                              key={commandKey}
                              className="rounded-md border border-white/10 bg-black/40"
                            >
                              <div className="flex items-start justify-between gap-2 px-3 py-2 text-[11px] text-slate-100">
                                <div className="flex min-w-0 items-start gap-2">
                                  <span className="text-slate-500">$</span>
                                  <code className="break-all">{commandDisplay}</code>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyText(entryCommand.command, "Command")
                                    }
                                    className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
                                    aria-label="Copy command"
                                  >
                                    Copy
                                  </button>
                                  {entryCommand.isError && (
                                    <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[9px] text-rose-200">
                                      error
                                    </span>
                                  )}
                                </div>
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

                              {outputsHidden && (hasStdout || hasStderr) && (
                                <div className="border-t border-white/10 px-3 py-2 text-[10px] text-slate-500">
                                  Output hidden by filters.
                                </div>
                              )}

                              {showStdout &&
                                hasStdout &&
                                renderOutputSection(
                                  "stdout",
                                  output?.stdout ?? "",
                                  `${commandKey}-stdout`,
                                  "text-emerald-300",
                                  "text-slate-100",
                                )}

                              {showStderr &&
                                hasStderr &&
                                renderOutputSection(
                                  "stderr",
                                  output?.stderr ?? "",
                                  `${commandKey}-stderr`,
                                  "text-rose-300",
                                  "text-rose-100",
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
                  ) : (
                    <div className="px-3 py-3 text-[10px] text-slate-500">
                      Collapsed to reduce rendering. Expand to view commands.
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
