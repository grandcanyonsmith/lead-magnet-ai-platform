"use client";

import {
  FiPlay,
  FiSkipForward,
  FiRotateCcw,
  FiSave,
  FiUpload,
  FiCode,
  FiLoader,
} from "react-icons/fi";

interface PlaygroundTopBarProps {
  isExecuting: boolean;
  stepsCount: number;
  onRunAll: () => void;
  onRunStep: () => void;
  onStop: () => void;
  onReset: () => void;
  onImport: () => void;
  onExport: () => void;
}

export function PlaygroundTopBar({
  isExecuting,
  stepsCount,
  onRunAll,
  onRunStep,
  onStop,
  onReset,
  onImport,
  onExport,
}: PlaygroundTopBarProps) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 bg-background border-b border-border shadow-sm z-10 shrink-0 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <FiCode className="text-primary" />
          Playground
        </h1>
        <div className="hidden h-6 w-px bg-border/60 sm:block" />
        <div className="flex flex-wrap items-center gap-2">
          {!isExecuting ? (
            <>
              <button
                onClick={onRunAll}
                disabled={stepsCount === 0}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors sm:px-3 sm:text-sm"
                title="Command+Enter"
              >
                <FiPlay className="w-4 h-4" />
                Run All
              </button>
              <button
                onClick={onRunStep}
                disabled={stepsCount === 0}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-background border border-border hover:bg-muted text-foreground rounded-md text-xs font-medium transition-colors disabled:opacity-50 sm:px-3 sm:text-sm"
              >
                <FiSkipForward className="w-4 h-4" />
                Run Step
              </button>
            </>
          ) : (
            <button
              onClick={onStop}
              className="flex items-center gap-2 px-2.5 py-1.5 bg-destructive text-destructive-foreground rounded-md text-xs font-medium hover:bg-destructive/90 transition-colors animate-pulse sm:px-3 sm:text-sm"
            >
              <FiLoader className="w-4 h-4 animate-spin" />
              Stop
            </button>
          )}

          <button
            onClick={onReset}
            disabled={isExecuting}
            className="flex items-center gap-2 px-2.5 py-1.5 bg-background border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 text-muted-foreground rounded-md text-xs font-medium transition-colors sm:px-3 sm:text-sm"
          >
            <FiRotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onImport}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          title="Import Workflow"
        >
          <FiUpload className="w-4 h-4" />
        </button>
        <button
          onClick={onExport}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          title="Save as Workflow"
        >
          <FiSave className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
