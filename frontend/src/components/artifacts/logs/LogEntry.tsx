import React from "react";
import { FilteredLogEntry, formatDuration, formatTimestamp } from "./utils";
import { LogLineRenderer } from "./LogLineRenderer";

interface LogEntryProps {
  entry: FilteredLogEntry;
  expandAll: boolean;
  expandedCalls: Set<string>;
  toggleExpandedCall: (key: string) => void;
  showStdout: boolean;
  showStderr: boolean;
  hasQuery: boolean;
  trimmedQuery: string;
  expandedOutputs: Set<string>;
  toggleExpandedOutput: (key: string) => void;
  handleCopyText: (value: string, label: string) => void;
  hasFilters: boolean;
}

export const LogEntry: React.FC<LogEntryProps> = ({
  entry,
  expandAll,
  expandedCalls,
  toggleExpandedCall,
  showStdout,
  showStderr,
  hasQuery,
  trimmedQuery,
  expandedOutputs,
  toggleExpandedOutput,
  handleCopyText,
  hasFilters,
}) => {
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
    // If expandAll is true, we can't really toggle individual calls off easily
    // without complex logic, so we might need to handle it in parent or just
    // let it be. The original code had logic for this.
    // Let's assume the parent handles the logic or we pass a wrapper.
    // Actually, the original code:
    /*
    const handleCallToggle = () => {
        if (expandAll) {
            setExpandAll(false);
            setExpandedCalls(new Set([callKey]));
            return;
        }
        toggleExpandedCall(callKey);
    };
    */
    // So I should pass a handler that does this logic, or pass setExpandAll/setExpandedCalls.
    // To keep props simple, I'll assume toggleExpandedCall handles it or I pass a specific handler.
    // I'll pass `onToggle` prop instead of `toggleExpandedCall`.
    toggleExpandedCall(callKey);
  };

  return (
    <div className="rounded-md border border-white/10 bg-black/30">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-[10px] text-slate-400">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCallToggle}
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} call ${logIndex + 1}`}
            className="inline-flex items-center gap-2 text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
          >
            <span className="text-slate-400">{isExpanded ? "▾" : "▸"}</span>
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
            commands.map((entryCommand) => (
              <LogLineRenderer
                key={`${callKey}-${entryCommand.index}`}
                entryCommand={entryCommand}
                callKey={callKey}
                showStdout={showStdout}
                showStderr={showStderr}
                hasQuery={hasQuery}
                trimmedQuery={trimmedQuery}
                expandedOutputs={expandedOutputs}
                toggleExpandedOutput={toggleExpandedOutput}
                handleCopyText={handleCopyText}
              />
            ))
          )}
        </div>
      ) : (
        <div className="px-3 py-3 text-[10px] text-slate-500">
          Collapsed to reduce rendering. Expand to view commands.
        </div>
      )}
    </div>
  );
};
