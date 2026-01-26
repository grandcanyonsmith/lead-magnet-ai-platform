"use client";

import { FiAlertCircle, FiCheckCircle, FiLoader } from "react-icons/fi";
import { usePlaygroundState } from "./hooks/usePlaygroundState";
import { PlaygroundHeader } from "./components/PlaygroundHeader";
import { PlaygroundTabs } from "./components/PlaygroundTabs";
import { PlaygroundFlowchart } from "./components/PlaygroundFlowchart";
import { ImportWorkflowModal } from "./components/ImportWorkflowModal";

export default function PlaygroundPage() {
  const state = usePlaygroundState();

  if (!state.stepsLoaded) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  const statusLabel = state.isExecuting
    ? state.activeStepNumber && state.stepsCount
      ? `Running step ${state.activeStepNumber} of ${state.stepsCount}`
      : "Running workflow"
    : state.stepsCount === 0
      ? "Add your first step"
      : "Ready";

  const StatusIcon = state.isExecuting
    ? FiLoader
    : state.stepsCount === 0
      ? FiAlertCircle
      : FiCheckCircle;

  const statusTone = state.isExecuting
    ? "bg-primary/10 text-primary dark:text-primary-300"
    : state.stepsCount === 0
      ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
      : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";

  return (
    <div className="flex min-h-[calc(100vh-65px)] flex-col bg-muted/30">
      <PlaygroundHeader
        handleImport={state.handleImport}
        handleExport={state.handleExport}
        isExecuting={state.isExecuting}
        stepsCount={state.stepsCount}
        selectedStepLabel={state.selectedStepLabel}
        handleRunAll={state.handleRunAll}
        handleRunNextStep={state.handleRunNextStep}
        handleStop={state.handleStop}
        handleReset={state.handleReset}
        statusTone={statusTone}
        statusLabel={statusLabel}
        StatusIcon={StatusIcon}
      />

      <div className="flex flex-col gap-4">
        <PlaygroundTabs
          activeTab={state.activeTab}
          setActiveTab={state.setActiveTab}
          executionResults={state.executionResults}
          currentInput={state.currentInput}
          setCurrentInput={state.setCurrentInput}
          selectedStepIndex={state.selectedStepIndex}
          steps={state.steps as any}
          deleteStep={state.deleteStep}
          updateStep={state.updateStep as any}
          moveStepUp={state.moveStepUp}
          moveStepDown={state.moveStepDown}
          addStep={state.addStep}
          setSelectedStepIndex={state.setSelectedStepIndex}
          contextSummary={state.contextSummary}
          isEditingContext={state.isEditingContext}
          handleCopyContext={state.handleCopyContext}
          handleEditContext={state.handleEditContext}
          handleSaveContext={state.handleSaveContext}
          setIsEditingContext={state.setIsEditingContext}
          contextEditValue={state.contextEditValue}
          setContextEditValue={state.setContextEditValue}
          accumulatedContext={state.accumulatedContext}
          logs={state.logs}
          setLogs={state.setLogs}
          setExecutionResults={state.setExecutionResults}
          logsEndRef={state.logsEndRef}
          isExecuting={state.isExecuting}
        />

        <PlaygroundFlowchart
          steps={state.steps as any}
          handleStepClick={state.handleStepClick}
          addStep={state.addStep}
          reorderSteps={state.reorderSteps as any}
          activeStepIndex={state.activeStepIndex}
          setActiveTab={state.setActiveTab}
        />
      </div>

      <ImportWorkflowModal
        importModalOpen={state.importModalOpen}
        setImportModalOpen={state.setImportModalOpen}
        loadingWorkflows={state.loadingWorkflows}
        availableWorkflows={state.availableWorkflows}
        selectWorkflowToImport={state.selectWorkflowToImport}
      />
    </div>
  );
}
