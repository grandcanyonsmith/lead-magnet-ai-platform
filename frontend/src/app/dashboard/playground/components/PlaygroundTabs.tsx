import React, { ComponentType } from "react";
import {
  FiFileText,
  FiSettings,
  FiDatabase,
  FiTerminal,
  FiCheckCircle,
  FiAlertCircle,
  FiEdit2,
  FiCheck,
} from "react-icons/fi";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { LogViewer } from "../components/LogViewer";
import WorkflowStepEditor from "../../workflows/components/WorkflowStepEditor";
import { SidebarTab, StepResult, AccumulatedContext } from "../types";
import { MergedStep } from "@/types/job";

type IconType = ComponentType<{ className?: string }>;

interface PlaygroundTabsProps {
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
  executionResults: StepResult[];
  currentInput: string;
  setCurrentInput: (input: string) => void;
  selectedStepIndex: number | null;
  steps: MergedStep[];
  deleteStep: (index: number) => void;
  updateStep: (index: number, step: MergedStep) => void;
  moveStepUp: (index: number) => void;
  moveStepDown: (index: number) => void;
  addStep: () => void;
  setSelectedStepIndex: (index: number | null) => void;
  contextSummary: { sizeKb: number; keys: number };
  isEditingContext: boolean;
  handleCopyContext: () => void;
  handleEditContext: () => void;
  handleSaveContext: () => void;
  setIsEditingContext: (isEditing: boolean) => void;
  contextEditValue: string;
  setContextEditValue: (value: string) => void;
  accumulatedContext: AccumulatedContext;
  logs: string[];
  setLogs: (logs: string[]) => void;
  setExecutionResults: (results: StepResult[]) => void;
  logsEndRef: React.RefObject<HTMLDivElement>;
  isExecuting: boolean;
}

export const PlaygroundTabs: React.FC<PlaygroundTabsProps> = ({
  activeTab,
  setActiveTab,
  executionResults,
  currentInput,
  setCurrentInput,
  selectedStepIndex,
  steps,
  deleteStep,
  updateStep,
  moveStepUp,
  moveStepDown,
  addStep,
  setSelectedStepIndex,
  contextSummary,
  isEditingContext,
  handleCopyContext,
  handleEditContext,
  handleSaveContext,
  setIsEditingContext,
  contextEditValue,
  setContextEditValue,
  accumulatedContext,
  logs,
  setLogs,
  setExecutionResults,
  logsEndRef,
  isExecuting,
}) => {
  const tabItems: {
    id: SidebarTab;
    label: string;
    icon: IconType;
    badge?: number;
  }[] = [
    { id: "input", label: "Input", icon: FiFileText },
    { id: "step-config", label: "Step", icon: FiSettings },
    { id: "context", label: "Context", icon: FiDatabase },
    {
      id: "logs",
      label: "Logs",
      icon: FiTerminal,
      badge: executionResults.length,
    },
  ];

  const tabButtonClasses = (tabId: SidebarTab) =>
    `group relative isolate flex-1 px-4 py-3 text-[13px] sm:text-sm font-semibold border-b-2 transition-all duration-200 flex items-center justify-center gap-2 rounded-t-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
      activeTab === tabId
        ? "border-primary text-primary bg-gradient-to-b from-primary/10 via-primary/5 to-transparent shadow-[inset_0_-1px_0_0_rgba(59,130,246,0.3)]"
        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
    }`;

  return (
    <div className="w-full min-h-[260px] bg-background border-t border-border flex flex-col shadow-xl z-20">
      {/* Tab Header */}
      <div
        className="flex border-b border-border bg-muted/5 px-1"
        role="tablist"
        aria-label="Playground panels"
      >
        {tabItems.map(({ id, label, icon: Icon, badge }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={tabButtonClasses(id)}
              aria-selected={isActive}
              role="tab"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
              {badge && badge > 0 ? (
                <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary px-2 text-[10px] font-semibold shadow-sm">
                  {badge}
                </span>
              ) : null}
              {isActive && (
                <span
                  className="pointer-events-none absolute inset-0 -z-10 rounded-t-md bg-gradient-to-b from-primary/10 via-primary/5 to-transparent"
                  aria-hidden="true"
                />
              )}
              {isActive && (
                <span
                  className="pointer-events-none absolute inset-x-6 bottom-[-2px] h-0.5 rounded-full bg-primary/80"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="relative">
        {/* INPUT TAB */}
        {activeTab === "input" && (
          <div className="flex flex-col">
            <div className="p-4 border-b border-border bg-muted/10">
              <h3 className="text-sm font-semibold">Initial Input</h3>
              <p className="text-xs text-muted-foreground mt-1">
                JSON data passed to the first step.
              </p>
            </div>
            <div className="p-0">
              <textarea
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                className="w-full min-h-[240px] bg-background p-4 text-xs font-mono resize-y focus:outline-none"
                placeholder="{}"
                spellCheck={false}
              />
            </div>
          </div>
        )}

        {/* STEP CONFIG TAB */}
        {activeTab === "step-config" && (
          <div className="flex flex-col">
            {selectedStepIndex !== null && steps[selectedStepIndex] ? (
              <div className="flex flex-col">
                <div className="p-4 border-b border-border bg-muted/10 sticky top-0 z-10 flex justify-between items-center backdrop-blur-md">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Step {selectedStepIndex + 1}:{" "}
                      {steps[selectedStepIndex].step_name || "Untitled"}
                    </h3>
                    <div className="flex gap-2 mt-1">
                      {executionResults.find(
                        (r) => r.stepIndex === selectedStepIndex
                      )?.status === "success" && (
                        <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <FiCheckCircle className="w-3 h-3" /> Completed
                        </span>
                      )}
                      {executionResults.find(
                        (r) => r.stepIndex === selectedStepIndex
                      )?.status === "error" && (
                        <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <FiAlertCircle className="w-3 h-3" /> Error
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteStep(selectedStepIndex)}
                    className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded"
                  >
                    Delete
                  </button>
                </div>
                <div className="p-4 pb-20">
                  <WorkflowStepEditor
                    step={steps[selectedStepIndex] as any}
                    index={selectedStepIndex}
                    totalSteps={steps.length}
                    allSteps={steps as any}
                    onChange={updateStep as any}
                    onDelete={() => {
                      deleteStep(selectedStepIndex);
                      setSelectedStepIndex(null);
                    }}
                    onMoveUp={moveStepUp}
                    onMoveDown={moveStepDown}
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
                  onClick={addStep}
                  className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
                >
                  Add New Step
                </button>
              </div>
            )}
          </div>
        )}

        {/* CONTEXT TAB */}
        {activeTab === "context" && (
          <div className="flex flex-col">
            <div className="p-4 border-b border-border bg-muted/10 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Accumulated Context</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Merged output from all executed steps.
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5">
                    Keys: {contextSummary.keys}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5">
                    ~{contextSummary.sizeKb} KB
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {!isEditingContext ? (
                  <>
                    <button
                      onClick={handleCopyContext}
                      className="text-[10px] border border-border bg-background hover:bg-muted px-2 py-1 rounded font-medium flex items-center gap-1"
                    >
                      <FiFileText className="w-3 h-3" /> Copy
                    </button>
                    <button
                      onClick={handleEditContext}
                      className="text-[10px] border border-border bg-background hover:bg-muted px-2 py-1 rounded font-medium flex items-center gap-1"
                    >
                      <FiEdit2 className="w-3 h-3" /> Edit
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleSaveContext}
                      className="text-[10px] bg-primary text-primary-foreground px-2 py-1 rounded font-medium flex items-center gap-1"
                    >
                      <FiCheck className="w-3 h-3" /> Save
                    </button>
                    <button
                      onClick={() => setIsEditingContext(false)}
                      className="text-[10px] border border-border bg-background hover:bg-muted px-2 py-1 rounded font-medium"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="p-4 bg-gradient-to-b from-muted/10 via-background to-background">
              {isEditingContext ? (
                <textarea
                  value={contextEditValue}
                  onChange={(e) => setContextEditValue(e.target.value)}
                  className="w-full min-h-[240px] font-mono text-xs bg-background p-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-inner resize-y"
                  spellCheck={false}
                />
              ) : (
                <div className="h-full rounded-xl border border-border/80 bg-card/60 dark:bg-card/70 shadow-inner p-3">
                  <JsonViewer
                    value={accumulatedContext}
                    defaultExpandedDepth={2}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* LOGS TAB */}
        {activeTab === "logs" && (
          <div className="flex flex-col">
            <div className="p-4 border-b border-border bg-muted/10 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold">Live Logs</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Real-time output from the worker.
                </p>
              </div>
              {(logs.length > 0 || executionResults.length > 0) && (
                <button
                  onClick={() => {
                    setLogs([]);
                    setExecutionResults([]);
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="p-4 bg-black/5 dark:bg-black/30 font-mono text-xs">
              {logs.length === 0 && executionResults.length === 0 && (
                <div className="text-center py-10 text-muted-foreground italic">
                  Ready to run.
                </div>
              )}

              <LogViewer logs={logs} />
              <div ref={logsEndRef} />

              {/* Structured Results Summary */}
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
                          <span className="font-bold">
                            Step {res.stepIndex + 1}
                          </span>
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
                              <JsonViewer
                                value={res.output}
                                defaultExpandedDepth={1}
                              />
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
};
