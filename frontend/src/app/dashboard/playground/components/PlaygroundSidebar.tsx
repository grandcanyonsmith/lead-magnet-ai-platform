"use client";

import type { RefObject } from "react";
import {
  FiAlertCircle,
  FiCheck,
  FiCheckCircle,
  FiDatabase,
  FiEdit2,
  FiFileText,
  FiSettings,
  FiTerminal,
} from "react-icons/fi";

import WorkflowStepEditor from "../../workflows/components/WorkflowStepEditor";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { LogViewer } from "./LogViewer";
import type { WorkflowStep } from "@/types/workflow";
import type { AccumulatedContext, SidebarTab, StepResult } from "../types";

interface PlaygroundSidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  currentInput: string;
  onInputChange: (value: string) => void;
  steps: WorkflowStep[];
  selectedStepIndex: number | null;
  onSelectStepIndex: (index: number | null) => void;
  onDeleteStep: (index: number) => void;
  onUpdateStep: (index: number, updatedStep: WorkflowStep) => void;
  onMoveStepUp: (index: number) => void;
  onMoveStepDown: (index: number) => void;
  onAddStep: () => void;
  executionResults: StepResult[];
  isEditingContext: boolean;
  contextEditValue: string;
  onEditContext: () => void;
  onSaveContext: () => void;
  onCancelContextEdit: () => void;
  onContextEditValueChange: (value: string) => void;
  accumulatedContext: AccumulatedContext;
  logs: string[];
  onClearLogs: () => void;
  logsEndRef: RefObject<HTMLDivElement>;
  isExecuting: boolean;
}

export function PlaygroundSidebar({
  activeTab,
  onTabChange,
  currentInput,
  onInputChange,
  steps,
  selectedStepIndex,
  onSelectStepIndex,
  onDeleteStep,
  onUpdateStep,
  onMoveStepUp,
  onMoveStepDown,
  onAddStep,
  executionResults,
  isEditingContext,
  contextEditValue,
  onEditContext,
  onSaveContext,
  onCancelContextEdit,
  onContextEditValueChange,
  accumulatedContext,
  logs,
  onClearLogs,
  logsEndRef,
  isExecuting,
}: PlaygroundSidebarProps) {
  const selectedStep =
    selectedStepIndex !== null ? steps[selectedStepIndex] : null;
  const selectedResult =
    selectedStepIndex !== null
      ? executionResults.find((result) => result.stepIndex === selectedStepIndex)
      : undefined;

  return (
    <div className="flex-1 w-full min-h-[260px] bg-background border-t border-border flex flex-col shadow-xl z-20 lg:min-h-0 lg:flex-none lg:w-[520px] xl:w-[600px] lg:border-l lg:border-t-0">
      <div className="flex border-b border-border bg-muted/5">
        <button
          onClick={() => onTabChange("input")}
          className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
            activeTab === "input"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <FiFileText /> Input
        </button>
        <button
          onClick={() => onTabChange("step-config")}
          className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
            activeTab === "step-config"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <FiSettings /> Step
        </button>
        <button
          onClick={() => onTabChange("context")}
          className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
            activeTab === "context"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <FiDatabase /> Context
        </button>
        <button
          onClick={() => onTabChange("logs")}
          className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
            activeTab === "logs"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <FiTerminal /> Logs
          {executionResults.length > 0 && (
            <span className="bg-muted-foreground/20 text-muted-foreground px-1.5 rounded-full text-[10px]">
              {executionResults.length}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {activeTab === "input" && (
          <div className="absolute inset-0 flex flex-col">
            <div className="p-4 border-b border-border bg-muted/10">
              <h3 className="text-sm font-semibold">Initial Input</h3>
              <p className="text-xs text-muted-foreground mt-1">
                JSON data passed to the first step.
              </p>
            </div>
            <div className="flex-1 p-0">
              <textarea
                value={currentInput}
                onChange={(e) => onInputChange(e.target.value)}
                className="w-full h-full bg-background p-4 text-xs font-mono resize-none focus:outline-none"
                placeholder="{}"
                spellCheck={false}
              />
            </div>
          </div>
        )}

        {activeTab === "step-config" && (
          <div className="absolute inset-0 flex flex-col overflow-hidden">
            {selectedStepIndex !== null && selectedStep ? (
              <div className="h-full overflow-y-auto">
                <div className="p-4 border-b border-border bg-muted/10 sticky top-0 z-10 flex justify-between items-center backdrop-blur-md">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Step {selectedStepIndex + 1}: {selectedStep.step_name || "Untitled"}
                    </h3>
                    <div className="flex gap-2 mt-1">
                      {selectedResult?.status === "success" && (
                        <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <FiCheckCircle className="w-3 h-3" /> Completed
                        </span>
                      )}
                      {selectedResult?.status === "error" && (
                        <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <FiAlertCircle className="w-3 h-3" /> Error
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onDeleteStep(selectedStepIndex);
                      onSelectStepIndex(null);
                    }}
                    className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded"
                  >
                    Delete
                  </button>
                </div>
                <div className="p-4 pb-20">
                  <WorkflowStepEditor
                    step={selectedStep}
                    index={selectedStepIndex}
                    totalSteps={steps.length}
                    allSteps={steps}
                    onChange={onUpdateStep}
                    onDelete={() => {
                      onDeleteStep(selectedStepIndex);
                      onSelectStepIndex(null);
                    }}
                    onMoveUp={onMoveStepUp}
                    onMoveDown={onMoveStepDown}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <FiSettings className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium">No Step Selected</p>
                <p className="text-xs mt-1 max-w-[200px]">
                  Click a step in the flowchart to edit its configuration.
                </p>
                <button
                  onClick={onAddStep}
                  className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
                >
                  Add New Step
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "context" && (
          <div className="absolute inset-0 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/10 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold">Accumulated Context</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Merged output from all executed steps.
                </p>
              </div>
              <div className="flex gap-2">
                {!isEditingContext ? (
                  <button
                    onClick={onEditContext}
                    className="text-[10px] border border-border bg-background hover:bg-muted px-2 py-1 rounded font-medium flex items-center gap-1"
                  >
                    <FiEdit2 className="w-3 h-3" /> Edit
                  </button>
                ) : (
                  <>
                    <button
                      onClick={onSaveContext}
                      className="text-[10px] bg-primary text-primary-foreground px-2 py-1 rounded font-medium flex items-center gap-1"
                    >
                      <FiCheck className="w-3 h-3" /> Save
                    </button>
                    <button
                      onClick={onCancelContextEdit}
                      className="text-[10px] border border-border bg-background hover:bg-muted px-2 py-1 rounded font-medium"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {isEditingContext ? (
                <textarea
                  value={contextEditValue}
                  onChange={(e) => onContextEditValueChange(e.target.value)}
                  className="w-full h-full font-mono text-xs bg-muted/30 p-2 rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                  spellCheck={false}
                />
              ) : (
                <JsonViewer value={accumulatedContext} defaultExpandedDepth={2} />
              )}
            </div>
          </div>
        )}

        {activeTab === "logs" && (
          <div className="absolute inset-0 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/10 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold">Live Logs</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Real-time output from the worker.
                </p>
              </div>
              {(logs.length > 0 || executionResults.length > 0) && (
                <button
                  onClick={onClearLogs}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex-1 overflow-auto p-4 bg-black/5 dark:bg-black/30 font-mono text-xs">
              {logs.length === 0 && executionResults.length === 0 && (
                <div className="text-center py-10 text-muted-foreground italic">
                  Ready to run.
                </div>
              )}

              <LogViewer logs={logs} />
              <div ref={logsEndRef} />

              {!isExecuting && executionResults.length > 0 && (
                <div className="mt-8 pt-4 border-t border-border">
                  <div className="mb-2 font-semibold text-foreground">
                    Step Results
                  </div>
                  <div className="space-y-2">
                    {executionResults.map((res, i) => (
                      <div
                        key={i}
                        className={`rounded border overflow-hidden ${
                          res.status === "success"
                            ? "bg-green-50/10 border-green-200/30"
                            : "bg-red-50/10 border-red-200/30"
                        }`}
                      >
                        <div className="px-2 py-1.5 flex justify-between items-center bg-muted/20">
                          <span className="font-bold">Step {res.stepIndex + 1}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">
                              {res.duration}ms
                            </span>
                            {res.status === "success" ? (
                              <FiCheckCircle className="text-green-500" />
                            ) : (
                              <FiAlertCircle className="text-red-500" />
                            )}
                          </div>
                        </div>
                        <div className="p-2">
                          {res.error ? (
                            <div className="text-red-500">{res.error}</div>
                          ) : (
                            <div className="max-h-32 overflow-auto">
                              <JsonViewer value={res.output} defaultExpandedDepth={1} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
