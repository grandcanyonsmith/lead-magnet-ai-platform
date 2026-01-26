import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  ShellExecutorLogsPayload,
  ShellExecutorLogsPreviewVariant,
  EMPTY_LOGS,
  LARGE_COMMAND_THRESHOLD,
  LARGE_CALL_THRESHOLD,
  formatLogsAsText,
  getStepLabel,
  getExecutorLabel,
  formatOutcome,
  isErrorOutput,
  matchesSearch,
  FilteredLogEntry,
} from "./logs/utils";
import { LogFilterControls } from "./logs/LogFilterControls";
import { LogEntry } from "./logs/LogEntry";

export { isShellExecutorLogsPayload } from "./logs/utils";
export type { ShellExecutorLogsPayload, ShellExecutorLogsPreviewVariant };

export function ShellExecutorLogsPreview({
  payload,
  variant = "default",
}: {
  payload: ShellExecutorLogsPayload;
  variant?: ShellExecutorLogsPreviewVariant;
}) {
  const logs = useMemo(
    () => (Array.isArray(payload.logs) ? payload.logs : EMPTY_LOGS),
    [payload.logs],
  );
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

  const toggleExpandedCall = useCallback(
    (callKey: string) => {
      if (expandAll) {
        setExpandAll(false);
        setExpandedCalls(new Set([callKey]));
        return;
      }
      setExpandedCalls((prev) => {
        const next = new Set(prev);
        if (next.has(callKey)) {
          next.delete(callKey);
        } else {
          next.add(callKey);
        }
        return next;
      });
    },
    [expandAll],
  );

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

  const resultsLabel = hasFilters
    ? `Showing ${matchedCalls}/${totalCalls} calls · ${matchedCommands}/${totalCommands} commands`
    : `${totalCalls} call${totalCalls === 1 ? "" : "s"} · ${totalCommands} command${
        totalCommands === 1 ? "" : "s"
      }`;

  return (
    <div
      className={`h-full w-full overflow-y-auto rounded-md bg-[#0d1117] text-xs text-slate-200 ${
        isCompact ? "scrollbar-hide-until-hover" : ""
      }`}
    >
      <LogFilterControls
        executorLabel={executorLabel}
        stepLabel={stepLabel}
        payload={payload}
        logs={logs}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        errorsOnly={errorsOnly}
        setErrorsOnly={setErrorsOnly}
        showStdout={showStdout}
        setShowStdout={setShowStdout}
        showStderr={showStderr}
        setShowStderr={setShowStderr}
        expandAll={expandAll}
        setExpandAll={setExpandAll}
        setExpandedCalls={setExpandedCalls}
        resultsLabel={resultsLabel}
        handleCopyAll={handleCopyAll}
        handleDownloadJson={handleDownloadJson}
        isCompact={isCompact}
      />

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
            filteredLogs.map((entry) => (
              <LogEntry
                key={`${entry.log.call_id || "call"}-${entry.logIndex}`}
                entry={entry}
                expandAll={expandAll}
                expandedCalls={expandedCalls}
                toggleExpandedCall={toggleExpandedCall}
                showStdout={showStdout}
                showStderr={showStderr}
                hasQuery={hasQuery}
                trimmedQuery={trimmedQuery}
                expandedOutputs={expandedOutputs}
                toggleExpandedOutput={toggleExpandedOutput}
                handleCopyText={handleCopyText}
                hasFilters={hasFilters}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
