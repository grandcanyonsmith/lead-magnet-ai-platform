import React from "react";
import { ShellExecutorLogsPayload, ShellExecutorCallLog } from "./utils";

interface LogFilterControlsProps {
  executorLabel: string;
  stepLabel: string;
  payload: ShellExecutorLogsPayload;
  logs: ShellExecutorCallLog[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  errorsOnly: boolean;
  setErrorsOnly: (value: boolean | ((prev: boolean) => boolean)) => void;
  showStdout: boolean;
  setShowStdout: (value: boolean | ((prev: boolean) => boolean)) => void;
  showStderr: boolean;
  setShowStderr: (value: boolean | ((prev: boolean) => boolean)) => void;
  expandAll: boolean;
  setExpandAll: (value: boolean | ((prev: boolean) => boolean)) => void;
  setExpandedCalls: (value: Set<string>) => void;
  resultsLabel: string;
  handleCopyAll: () => void;
  handleDownloadJson: () => void;
  isCompact: boolean;
}

export const LogFilterControls: React.FC<LogFilterControlsProps> = ({
  executorLabel,
  stepLabel,
  payload,
  logs,
  searchQuery,
  setSearchQuery,
  errorsOnly,
  setErrorsOnly,
  showStdout,
  setShowStdout,
  showStderr,
  setShowStderr,
  expandAll,
  setExpandAll,
  setExpandedCalls,
  resultsLabel,
  handleCopyAll,
  handleDownloadJson,
  isCompact,
}) => {
  const toggleClass = (active: boolean, activeClasses: string) =>
    `inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 ${
      active
        ? activeClasses
        : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
    }`;

  const actionButtonClass =
    "inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60";

  return (
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
            "border-rose-400/30 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"
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
            "border-emerald-400/30 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
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
            "border-amber-400/30 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
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
            "border-sky-400/30 bg-sky-500/20 text-sky-200 hover:bg-sky-500/30"
          )}
        >
          Expand all
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
          <span>{resultsLabel}</span>
          <button
            type="button"
            onClick={handleCopyAll}
            className={actionButtonClass}
          >
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
  );
};
