import { useMemo } from "react";
import {
  formatLogMessage,
  formatTimestamp,
  getLogLevelBucket,
  LogEntry,
} from "./utils";

interface LogLineProps {
  log: LogEntry;
  searchQuery: string;
  isMatch: boolean;
  isCurrentMatch: boolean;
  index: number;
  onRef: (el: HTMLDivElement | null) => void;
  showLineNumbers: boolean;
  showTimestamps: boolean;
  wrapLines: boolean;
  isExpandable: boolean;
  isExpanded: boolean;
  onToggleExpand: (index: number) => void;
}

export function LogLine({
  log,
  searchQuery,
  isMatch,
  isCurrentMatch,
  index,
  onRef,
  showLineNumbers,
  showTimestamps,
  wrapLines,
  isExpandable,
  isExpanded,
  onToggleExpand,
}: LogLineProps) {
  const levelBucket = getLogLevelBucket(log);
  const levelTextClass =
    levelBucket === "error"
      ? "text-red-300"
      : levelBucket === "warn"
        ? "text-yellow-300"
        : "text-gray-300";
  const shouldCollapse = isExpandable && !isExpanded;

  // Log level badge styling
  const levelBadgeClass =
    levelBucket === "error"
      ? "bg-red-500/20 text-red-300 border-red-500/30"
      : levelBucket === "warn"
        ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
        : "bg-gray-500/20 text-gray-300 border-gray-500/30";
  const levelLabel = levelBucket.toUpperCase();

  // Detect Shell Input/Output
  const isShellInput = log.message.startsWith("💻");
  const isShellOutput = log.message.startsWith("📤");
  const isShellError = log.message.startsWith("⚠️");

  // Strip prefixes for display if it's shell input/output
  const displayMessage =
    isShellInput || isShellOutput || isShellError
      ? log.message.substring(2).trim()
      : log.message;

  // If searching, use the highlighter logic
  const content = useMemo(() => {
    if (searchQuery && isMatch) {
      const parts = displayMessage.split(
        new RegExp(
          `(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
          "gi",
        ),
      );
      return (
        <span className={levelTextClass}>
          {parts.map((part, i) =>
            part.toLowerCase() === searchQuery.toLowerCase() ? (
              <mark
                key={i}
                className={`bg-yellow-400 text-gray-900 px-0.5 rounded ${
                  isCurrentMatch
                    ? "ring-2 ring-yellow-300 ring-offset-1 ring-offset-[#0d1117]"
                    : ""
                }`}
              >
                {part}
              </mark>
            ) : (
              <span key={i}>{part}</span>
            ),
          )}
        </span>
      );
    }

    // Otherwise use the rich formatter
    return (
      <div className={levelTextClass}>{formatLogMessage(displayMessage)}</div>
    );
  }, [displayMessage, searchQuery, isMatch, isCurrentMatch, levelTextClass]);

  // Determine background class based on type
  let bgClass = "";
  if (levelBucket === "error") bgClass = "bg-red-500/10";
  else if (levelBucket === "warn") bgClass = "bg-yellow-500/10";
  if (isShellInput) bgClass = "bg-blue-900/20 border-l-2 border-blue-500/50";
  if (isShellOutput)
    bgClass = "bg-emerald-900/10 border-l-2 border-emerald-500/30";
  if (isShellError) bgClass = "bg-red-900/10 border-l-2 border-red-500/30";

  if (isCurrentMatch) bgClass = "bg-blue-500/40";
  else if (isMatch && !isCurrentMatch) bgClass = "bg-yellow-500/20";

  return (
    <div
      ref={onRef}
      className={`
        flex items-start gap-3 py-1 px-3 sm:px-4 hover:bg-white/5 transition-colors font-mono text-[12px] sm:text-[13px] leading-5 sm:leading-6 group
        ${bgClass}
      `}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 w-full">
        {/* Line number */}
        {showLineNumbers && (
          <div className="text-gray-500 dark:text-gray-400 text-[11px] font-mono shrink-0 min-w-[3ch] text-right">
            {index + 1}
          </div>
        )}
        
        {/* Timestamp */}
        {showTimestamps && (
          <div className="text-gray-500 dark:text-gray-400 text-[11px] font-mono shrink-0 min-w-[8ch]">
            {formatTimestamp(log.timestamp)}
          </div>
        )}
        
        {/* Log level badge */}
        <div className="shrink-0">
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${levelBadgeClass}`}
          >
            {levelLabel}
          </span>
        </div>
        
        <div
          className={`w-full min-h-[1.5em] ${
            wrapLines
              ? "whitespace-pre-wrap break-words"
              : "whitespace-pre overflow-x-auto"
          }`}
        >
          <div className={shouldCollapse ? "max-h-24 overflow-y-hidden" : ""}>
            {content}
          </div>
          {isExpandable && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleExpand(index);
              }}
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-300 hover:text-blue-200"
              title={isExpanded ? "Collapse log entry" : "Expand log entry"}
            >
              {isExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
