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
import { SidebarTab } from "../types";
import { usePlaygroundContext } from "../context/PlaygroundContext";
import { RecursiveTabs, TabNode } from "@/components/ui/recursive/RecursiveTabs";

export const PlaygroundTabs: React.FC = () => {
  const {
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
  } = usePlaygroundContext();

  const InputTabContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border bg-muted/10">
        <h3 className="text-sm font-semibold">Initial Input</h3>
        <p className="text-xs text-muted-foreground mt-1">
          JSON data passed to the first step.
        </p>
      </div>
      <div className="p-0 flex-1">
        <textarea
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          className="w-full h-full bg-background p-4 text-xs font-mono resize-none focus:outline-none"
          placeholder="{}"
          spellCheck={false}
        />
      </div>
    </div>
  );

  const StepConfigTabContent = (
    <div className="flex flex-col h-full">
      {selectedStepIndex !== null && steps[selectedStepIndex] ? (
        <div className="flex flex-col h-full">
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
          <div className="p-4 pb-20 flex-1 overflow-y-auto">
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
  );

  const ContextTabContent = (
    <div className="flex flex-col h-full">
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
      <div className="p-4 bg-gradient-to-b from-muted/10 via-background to-background flex-1 overflow-hidden">
        {isEditingContext ? (
          <textarea
            value={contextEditValue}
            onChange={(e) => setContextEditValue(e.target.value)}
            className="w-full h-full font-mono text-xs bg-background p-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-inner resize-none"
            spellCheck={false}
          />
        ) : (
          <div className="h-full rounded-xl border border-border/80 bg-card/60 dark:bg-card/70 shadow-inner p-3 overflow-auto">
            <JsonViewer
              value={accumulatedContext}
              defaultExpandedDepth={2}
            />
          </div>
        )}
      </div>
    </div>
  );

  const LogsTabContent = (
    <div className="flex flex-col h-full">
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
      <div className="p-4 bg-black/5 dark:bg-black/30 font-mono text-xs flex-1 overflow-auto">
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
  );

  const tabs: TabNode[] = [
    {
      id: "input",
      label: "Input",
      icon: FiFileText,
      content: InputTabContent,
    },
    {
      id: "step-config",
      label: "Step",
      icon: FiSettings,
      content: StepConfigTabContent,
    },
    {
      id: "context",
      label: "Context",
      icon: FiDatabase,
      content: ContextTabContent,
    },
    {
      id: "logs",
      label: "Logs",
      icon: FiTerminal,
      badge: executionResults.length,
      content: LogsTabContent,
    },
  ];

  return (
    <div className="w-full min-h-[260px] bg-background border-t border-border flex flex-col shadow-xl z-20">
      <RecursiveTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as SidebarTab)}
      />
    </div>
  );
};
