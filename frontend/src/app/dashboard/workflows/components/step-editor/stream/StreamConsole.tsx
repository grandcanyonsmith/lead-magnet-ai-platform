import { RefObject } from "react";
import {
  FiAlertCircle,
  FiArrowDown,
  FiCopy,
  FiDownload,
  FiMaximize2,
  FiMinimize2,
  FiPause,
  FiPlay,
  FiSearch,
  FiTerminal,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { LogLine } from "./LogLine";
import { LogEntry, LogLevelFilter } from "./utils";

interface StreamConsoleProps {
  viewMode: "split" | "terminal" | "preview";
  setViewMode: (mode: "split" | "terminal" | "preview") => void;
  summaryMeta: { base: string; details: string };
  autoScroll: boolean;
  setAutoScroll: (value: boolean) => void;
  scrollToBottom: () => void;
  copyLogs: () => void;
  downloadLogs: (format: "txt" | "json") => void;
  clearLogs: () => void;
  filterLevel: LogLevelFilter;
  setFilterLevel: (level: LogLevelFilter) => void;
  logCounts: { all: number; info: number; warn: number; error: number };
  wrapLines: boolean;
  setWrapLines: (value: boolean | ((prev: boolean) => boolean)) => void;
  showTimestamps: boolean;
  setShowTimestamps: (value: boolean | ((prev: boolean) => boolean)) => void;
  showLineNumbers: boolean;
  setShowLineNumbers: (value: boolean | ((prev: boolean) => boolean)) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  searchInputRef: RefObject<HTMLInputElement>;
  matchingIndices: number[];
  currentMatchIndex: number;
  navigateMatch: (direction: "next" | "prev") => void;
  scrollRef: RefObject<HTMLDivElement>;
  handleScroll: () => void;
  filteredLogs: LogEntry[];
  logs: LogEntry[];
  error: string | null;
  toggleExpandLog: (index: number) => void;
  expandedLogs: Set<number>;
  matchRefs: RefObject<(HTMLDivElement | null)[]>;
}

export function StreamConsole({
  viewMode,
  setViewMode,
  summaryMeta,
  autoScroll,
  setAutoScroll,
  scrollToBottom,
  copyLogs,
  downloadLogs,
  clearLogs,
  filterLevel,
  setFilterLevel,
  logCounts,
  wrapLines,
  setWrapLines,
  showTimestamps,
  setShowTimestamps,
  showLineNumbers,
  setShowLineNumbers,
  searchQuery,
  setSearchQuery,
  searchInputRef,
  matchingIndices,
  currentMatchIndex,
  navigateMatch,
  scrollRef,
  handleScroll,
  filteredLogs,
  logs,
  error,
  toggleExpandLog,
  expandedLogs,
  matchRefs,
}: StreamConsoleProps) {
  return (
    <div
      className={`flex flex-col min-w-0 transition-all duration-300 ease-in-out bg-[#0d1117] ${
        viewMode === "split"
          ? "w-1/2 border-r border-gray-800"
          : viewMode === "terminal"
            ? "w-full"
            : "hidden"
      }`}
    >
      {/* Console Toolbar */}
      <div className="flex flex-col gap-3 px-3 py-2 bg-[#161b22] border-b border-gray-800 text-xs select-none">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-semibold text-gray-300 flex items-center gap-2">
              <FiTerminal /> Console Output
            </span>
            <span className="text-[11px] text-gray-500">
              {summaryMeta.base}
            </span>
            {summaryMeta.details && (
              <span className="hidden sm:inline text-[11px] text-gray-500">
                • {summaryMeta.details}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() =>
                setViewMode(viewMode === "terminal" ? "split" : "terminal")
              }
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
              title={
                viewMode === "terminal" ? "Minimize Console" : "Maximize Console"
              }
            >
              {viewMode === "terminal" ? (
                <FiMinimize2 className="w-3.5 h-3.5" />
              ) : (
                <FiMaximize2 className="w-3.5 h-3.5" />
              )}
            </button>
            <div className="w-px h-3 bg-gray-700 mx-1" />
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors ${
                autoScroll
                  ? "text-emerald-300 bg-emerald-900/20 border-emerald-800/70"
                  : "text-gray-400 border-gray-700 hover:text-gray-200 hover:border-gray-600"
              }`}
              title={autoScroll ? "Stick to bottom" : "Manual scroll"}
            >
              {autoScroll ? (
                <FiPlay className="w-3 h-3" />
              ) : (
                <FiPause className="w-3 h-3" />
              )}
              <span className="hidden sm:inline">
                {autoScroll ? "Stick to bottom" : "Manual scroll"}
              </span>
              <span className="sm:hidden">
                {autoScroll ? "Auto" : "Manual"}
              </span>
            </button>
            {!autoScroll && (
              <button
                onClick={scrollToBottom}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
                title="Jump to latest"
              >
                <FiArrowDown className="w-3 h-3" />
                <span className="hidden sm:inline">Jump to latest</span>
              </button>
            )}
            <div className="flex items-center gap-1 rounded-md border border-gray-700/70 bg-[#0d1117] px-1 py-0.5">
              <button
                onClick={copyLogs}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="Copy visible logs"
              >
                <FiCopy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => downloadLogs("txt")}
                className="flex items-center gap-1 px-1.5 sm:px-2 py-1 text-[11px] text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="Download visible logs (.txt)"
              >
                <FiDownload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">TXT</span>
                <span className="sm:hidden">T</span>
              </button>
              <button
                onClick={() => downloadLogs("json")}
                className="px-1.5 sm:px-2 py-1 text-[11px] font-mono text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="Download visible logs (.json)"
              >
                <span className="hidden sm:inline">JSON</span>
                <span className="sm:hidden">J</span>
              </button>
              <button
                onClick={clearLogs}
                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                title="Clear Logs"
              >
                <FiTrash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-1 overflow-x-auto sm:overflow-visible scrollbar-hide">
            {[
              {
                value: "all",
                label: "All",
                count: logCounts.all,
                accent: "text-gray-300",
              },
              {
                value: "info",
                label: "Info",
                count: logCounts.info,
                accent: "text-blue-300",
              },
              {
                value: "warn",
                label: "Warn",
                count: logCounts.warn,
                accent: "text-yellow-300",
              },
              {
                value: "error",
                label: "Error",
                count: logCounts.error,
                accent: "text-red-300",
              },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setFilterLevel(option.value as LogLevelFilter)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] transition-colors whitespace-nowrap ${
                  filterLevel === option.value
                    ? "border-blue-500/70 text-blue-200 bg-blue-500/10"
                    : "border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600"
                }`}
                title={`Show ${option.label.toLowerCase()} logs`}
              >
                <span className={option.accent}>{option.label}</span>
                <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-300">
                  {option.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search + view controls */}
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:ml-auto sm:w-auto">
            <div className="flex flex-wrap items-center gap-1 rounded-md border border-gray-700 bg-[#0d1117] px-1 py-0.5 text-[11px] text-gray-400">
              <span className="px-1 text-gray-500">View</span>
              <button
                onClick={() => setWrapLines((prev) => !prev)}
                aria-pressed={wrapLines}
                className={`px-2 py-1 rounded transition-colors ${
                  wrapLines
                    ? "text-blue-200 bg-blue-500/10"
                    : "text-gray-400 hover:text-gray-200"
                }`}
                title={
                  wrapLines ? "Disable line wrapping" : "Enable line wrapping"
                }
              >
                Wrap
              </button>
              <button
                onClick={() => setShowTimestamps((prev) => !prev)}
                aria-pressed={showTimestamps}
                className={`px-2 py-1 rounded transition-colors ${
                  showTimestamps
                    ? "text-blue-200 bg-blue-500/10"
                    : "text-gray-400 hover:text-gray-200"
                }`}
                title={showTimestamps ? "Hide timestamps" : "Show timestamps"}
              >
                Time
              </button>
              <button
                onClick={() => setShowLineNumbers((prev) => !prev)}
                aria-pressed={showLineNumbers}
                className={`px-2 py-1 rounded transition-colors ${
                  showLineNumbers
                    ? "text-blue-200 bg-blue-500/10"
                    : "text-gray-400 hover:text-gray-200"
                }`}
                title={
                  showLineNumbers ? "Hide line numbers" : "Show line numbers"
                }
              >
                Line #
              </button>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <div className="relative w-full sm:min-w-[220px]">
                <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search logs, levels, timestamps..."
                  className="w-full pl-8 pr-8 py-1.5 bg-[#0d1117] border border-gray-700 rounded text-gray-200 placeholder-gray-500 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-500 hover:text-gray-300 rounded"
                    title="Clear search"
                  >
                    <FiX className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {searchQuery.trim() && matchingIndices.length > 0 && (
                <div className="flex items-center gap-1 text-gray-500">
                  <button
                    onClick={() => navigateMatch("prev")}
                    className="px-2 py-1 hover:bg-white/10 rounded transition-colors"
                    title="Previous match (Shift+Enter)"
                  >
                    ↑
                  </button>
                  <span className="text-[10px] min-w-[45px] text-center">
                    {currentMatchIndex + 1}/{matchingIndices.length}
                  </span>
                  <button
                    onClick={() => navigateMatch("next")}
                    className="px-2 py-1 hover:bg-white/10 rounded transition-colors"
                    title="Next match (Enter)"
                  >
                    ↓
                  </button>
                </div>
              )}
              {searchQuery.trim() && matchingIndices.length === 0 && (
                <span className="text-[10px] text-gray-500">No matches</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 sm:p-3 scrollbar-hide"
      >
        <div className="space-y-0.5">
          {filteredLogs.map((log) => {
            const originalIndex = logs.indexOf(log);
            const isMatch = searchQuery.trim()
              ? matchingIndices.includes(originalIndex)
              : false;
            const isCurrentMatch =
              isMatch && matchingIndices[currentMatchIndex] === originalIndex;
            const rawMessage = log.message || "";
            const lineCount = rawMessage.split("\n").length;
            const isExpandable = rawMessage.length > 320 || lineCount > 4;
            const isExpanded = expandedLogs.has(originalIndex);

            return (
              <LogLine
                key={originalIndex}
                log={log}
                searchQuery={searchQuery}
                isMatch={isMatch}
                isCurrentMatch={isCurrentMatch}
                index={originalIndex}
                showLineNumbers={showLineNumbers}
                showTimestamps={showTimestamps}
                wrapLines={wrapLines}
                isExpandable={isExpandable}
                isExpanded={isExpanded}
                onToggleExpand={toggleExpandLog}
                onRef={(el) => {
                  if (matchRefs.current) {
                    matchRefs.current[originalIndex] = el;
                  }
                }}
              />
            );
          })}
          {logs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
              <FiTerminal className="w-8 h-8 opacity-20" />
              <span className="text-sm">Ready to connect...</span>
            </div>
          )}
          {logs.length > 0 && filteredLogs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
              <FiSearch className="w-8 h-8 opacity-20" />
              {searchQuery.trim() ? (
                <span className="text-sm">
                  No logs match &quot;{searchQuery}&quot;
                </span>
              ) : (
                <span className="text-sm">
                  No {filterLevel === "all" ? "" : `${filterLevel} `}logs in
                  view
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-900/20 border-t border-red-900/50 text-red-400 text-xs flex items-start gap-2 animate-in slide-in-from-bottom-2">
          <FiAlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}
    </div>
  );
}
