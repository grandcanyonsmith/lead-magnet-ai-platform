import React, { ComponentType } from "react";
import {
  FiCode,
  FiUpload,
  FiSave,
  FiPlay,
  FiSkipForward,
  FiLoader,
  FiRotateCcw,
} from "react-icons/fi";

interface PlaygroundHeaderProps {
  handleImport: () => void;
  handleExport: () => void;
  isExecuting: boolean;
  stepsCount: number;
  selectedStepLabel: string | null;
  handleRunAll: () => void;
  handleRunNextStep: () => void;
  handleStop: () => void;
  handleReset: () => void;
  statusTone: string;
  statusLabel: string;
  StatusIcon: ComponentType<{ className?: string }>;
}

export const PlaygroundHeader: React.FC<PlaygroundHeaderProps> = ({
  handleImport,
  handleExport,
  isExecuting,
  stepsCount,
  selectedStepLabel,
  handleRunAll,
  handleRunNextStep,
  handleStop,
  handleReset,
  statusTone,
  statusLabel,
  StatusIcon,
}) => {
  return (
    <div className="flex flex-col gap-4 px-4 py-4 bg-background border-b border-border shadow-sm z-10 shrink-0 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FiCode className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Playground</h1>
            <p className="text-xs text-muted-foreground">
              Iterate on steps, review logs, and export when ready.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleImport}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:text-sm"
            title="Import workflow"
          >
            <FiUpload className="h-4 w-4" />
            <span className="hidden sm:inline">Import</span>
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:text-sm"
            title="Save as workflow"
          >
            <FiSave className="h-4 w-4" />
            <span className="hidden sm:inline">Save</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap items-center gap-2"
          role="status"
          aria-live="polite"
        >
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold ${statusTone}`}
          >
            <StatusIcon
              className={`h-3.5 w-3.5 ${isExecuting ? "animate-spin" : ""}`}
            />
            {statusLabel}
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            Steps: {stepsCount}
          </span>
          {selectedStepLabel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground">
              Selected:
              <span
                className="max-w-[180px] truncate font-medium text-foreground"
                title={selectedStepLabel}
              >
                {selectedStepLabel}
              </span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isExecuting ? (
            <>
              <button
                onClick={handleRunAll}
                disabled={stepsCount === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50 sm:text-sm"
                title="Cmd/Ctrl + Enter"
              >
                <FiPlay className="h-4 w-4" />
                Run All
                <span className="hidden sm:inline-flex items-center rounded bg-primary-foreground/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/90">
                  Cmd/Ctrl + Enter
                </span>
              </button>
              <button
                onClick={handleRunNextStep}
                disabled={stepsCount === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50 sm:text-sm"
                title="Run the next step"
              >
                <FiSkipForward className="h-4 w-4" />
                Run Next
              </button>
            </>
          ) : (
            <button
              onClick={handleStop}
              className="inline-flex items-center gap-2 rounded-lg bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground shadow-sm transition-colors hover:bg-destructive/90 sm:text-sm"
            >
              <FiLoader className="h-4 w-4 animate-spin" />
              Stop
            </button>
          )}

          <button
            onClick={handleReset}
            disabled={isExecuting}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 sm:text-sm"
          >
            <FiRotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};
