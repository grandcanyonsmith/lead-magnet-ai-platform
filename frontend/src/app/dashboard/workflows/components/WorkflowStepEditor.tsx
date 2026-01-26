"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  FiTrash2,
  FiChevronUp,
  FiChevronDown,
  FiSettings,
  FiGlobe,
  FiMaximize2,
} from "react-icons/fi";
import { useWorkflowStepAI } from "@/hooks/useWorkflowStepAI";
import { WorkflowStep } from "@/types/workflow";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { CollapsibleSection } from "@/components/workflows/edit/CollapsibleSection";

import AIAssist from "./step-editor/AIAssist";
import WebhookConfig from "./step-editor/WebhookConfig";
import HandoffConfig from "./step-editor/HandoffConfig";
import StepTester from "./step-editor/StepTester";
import StepEditorNav from "./step-editor/StepEditorNav";
import StepEditorSection from "./step-editor/StepEditorSection";

import { useStepEditorState } from "./step-editor/hooks/useStepEditorState";
import { STEP_EDITOR_SECTIONS } from "./step-editor/constants";

import StepBasics from "./step-editor/sections/StepBasics";
import ModelConfig from "./step-editor/sections/ModelConfig";
import InstructionsEditor from "./step-editor/sections/InstructionsEditor";
import OutputSettings from "./step-editor/sections/OutputSettings";
import ToolsConfig from "./step-editor/sections/ToolsConfig";
import DependenciesConfig from "./step-editor/sections/DependenciesConfig";

interface WorkflowStepEditorProps {
  step: WorkflowStep;
  index: number;
  totalSteps: number;
  allSteps?: WorkflowStep[]; // All steps for dependency selection
  onChange: (index: number, step: WorkflowStep) => void;
  onDelete: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  workflowId?: string; // Required for AI features
}

type StepEditorSectionId = "basics" | "integrations";

export default function WorkflowStepEditor({
  step,
  index,
  totalSteps,
  allSteps = [],
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  workflowId,
}: WorkflowStepEditorProps) {
  const {
    localStep,
    setLocalStep,
    handleChange,
    computerUseConfig,
    imageGenerationConfig,
    handleToolToggle,
    handleShellSettingChange,
    handleComputerUseConfigChange,
    handleImageGenerationConfigChange,
    isToolSelected,
  } = useStepEditorState({ step, index, onChange });

  const [activeSection, setActiveSection] = useState<StepEditorSectionId>("basics");
  const [isFocusMode, setIsFocusMode] = useState(false);
  const previousSectionRef = useRef<StepEditorSectionId>("basics");

  const [isWebhookCollapsed, setIsWebhookCollapsed] = useState(true);
  const [isHandoffCollapsed, setIsHandoffCollapsed] = useState(true);
  const [isAssistCollapsed, setIsAssistCollapsed] = useState(true);

  // Always call hook unconditionally to comply with Rules of Hooks
  const workflowStepAI = useWorkflowStepAI(workflowId);

  const handleToggleFocusMode = () => {
    if (!isFocusMode) {
      previousSectionRef.current = activeSection;
      setActiveSection("basics");
      setIsFocusMode(true);
      return;
    }

    setIsFocusMode(false);
    setActiveSection(previousSectionRef.current);
  };

  // Reset section state when switching steps.
  useEffect(() => {
    setActiveSection("basics");
    setIsFocusMode(false);
    previousSectionRef.current = "basics";
  }, [index]);

  // Render the step editor with error boundary
  return (
    <ErrorBoundary
      fallback={
        <div className="border border-red-300 dark:border-red-900 rounded-lg p-6 bg-red-50 dark:bg-red-900/20">
          <p className="text-red-800 dark:text-red-200 font-medium">
            Error loading step editor
          </p>
          <p className="text-red-600 dark:text-red-300 text-sm mt-1">
            Please refresh the page or try again.
          </p>
        </div>
      }
    >
      <div className="rounded-2xl border border-border/60 bg-background p-4 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-border/60">
          <div
            className="flex items-center gap-4"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary font-semibold shadow-inner">
              {index + 1}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground select-none">
                  {localStep.step_name || "Untitled step"}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-[11px] text-muted-foreground">
                  Step {index + 1}
                </span>
                {localStep.is_deliverable && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                    Deliverable
                  </span>
                )}
                {isFocusMode && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                    <FiMaximize2 className="h-3 w-3" aria-hidden />
                    Focus
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Drag in the flowchart to reorder or edit below.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleFocusMode}
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors shadow-sm ${
                isFocusMode
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-background/70 text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={isFocusMode}
            >
              <FiMaximize2 className="h-4 w-4" aria-hidden />
              {isFocusMode ? "Exit Focus" : "Focus Mode"}
            </button>
            <button
              type="button"
              onClick={() => onMoveUp(index)}
              disabled={index === 0}
              className="rounded-lg border border-border bg-background/60 p-2 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed touch-target"
              aria-label="Move step up"
            >
              <FiChevronUp className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => onMoveDown(index)}
              disabled={index === totalSteps - 1}
              className="rounded-lg border border-border bg-background/60 p-2 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed touch-target"
              aria-label="Move step down"
            >
              <FiChevronDown className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(index)}
              className="rounded-lg border border-destructive/30 bg-background/60 p-2 text-destructive shadow-sm hover:bg-destructive/10 hover:text-destructive touch-target"
              aria-label="Delete step"
            >
              <FiTrash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <CollapsibleSection
            title="AI Assist (Beta)"
            isCollapsed={isAssistCollapsed}
            onToggle={() => setIsAssistCollapsed(!isAssistCollapsed)}
          >
            <AIAssist
              workflowId={workflowId}
              step={localStep}
              index={index}
              useWorkflowStepAI={workflowStepAI}
              onAccept={(proposed) => {
                setLocalStep(proposed);
                onChange(index, proposed);
              }}
              collapsible={false}
              allSteps={allSteps}
            />
          </CollapsibleSection>
          <StepTester step={localStep} index={index} />
        </div>

        <div className="mt-6 flex flex-col gap-6">
          <div className="rounded-2xl border border-border/60 bg-background/90 shadow-sm">
            <div className="p-4 space-y-6 sm:p-6 sm:space-y-8">
              {activeSection === "basics" && (
                <StepEditorSection
                  title="Step basics"
                  description="Name, description, and model defaults"
                  icon={FiSettings}
                  showHeader={false}
                >
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <StepBasics
                        step={localStep}
                        index={index}
                        onChange={handleChange}
                        isFocusMode={isFocusMode}
                      />
                      <ModelConfig
                        step={localStep}
                        index={index}
                        onChange={handleChange}
                      />
                    </div>

                    <InstructionsEditor
                      step={localStep}
                      index={index}
                      onChange={handleChange}
                      isFocusMode={isFocusMode}
                    />

                    <OutputSettings
                      step={localStep}
                      index={index}
                      onChange={handleChange}
                    />

                    <ToolsConfig
                      step={localStep}
                      index={index}
                      onChange={handleChange}
                      isToolSelected={isToolSelected}
                      handleToolToggle={handleToolToggle}
                      computerUseConfig={computerUseConfig}
                      handleComputerUseConfigChange={handleComputerUseConfigChange}
                      imageGenerationConfig={imageGenerationConfig}
                      handleImageGenerationConfigChange={
                        handleImageGenerationConfigChange
                      }
                      handleShellSettingChange={handleShellSettingChange}
                    />

                    <DependenciesConfig
                      step={localStep}
                      index={index}
                      allSteps={allSteps}
                      onChange={handleChange}
                    />
                  </div>
                </StepEditorSection>
              )}

              {activeSection === "integrations" && (
                <StepEditorSection
                  title="Integrations"
                  description="Send data to APIs or another workflow"
                  icon={FiGlobe}
                  showHeader={false}
                >
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-1">
                      Webhook:{" "}
                      {localStep.webhook_url || localStep.step_type === "webhook"
                        ? "Configured"
                        : "Not set"}
                    </span>
                    <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-1">
                      Handoff:{" "}
                      {localStep.handoff_workflow_id?.trim()
                        ? "Configured"
                        : "Not set"}
                    </span>
                  </div>

                  <CollapsibleSection
                    title="Webhook / API Request"
                    isCollapsed={isWebhookCollapsed}
                    onToggle={() => setIsWebhookCollapsed(!isWebhookCollapsed)}
                  >
                    <WebhookConfig
                      step={localStep}
                      index={index}
                      allSteps={allSteps}
                      workflowId={workflowId}
                      onChange={handleChange}
                    />
                  </CollapsibleSection>

                  <CollapsibleSection
                    title="Send to another Lead Magnet"
                    isCollapsed={isHandoffCollapsed}
                    onToggle={() => setIsHandoffCollapsed(!isHandoffCollapsed)}
                  >
                    <HandoffConfig
                      step={localStep}
                      workflowId={workflowId}
                      onChange={handleChange}
                    />
                  </CollapsibleSection>
                </StepEditorSection>
              )}
            </div>
          </div>
          <div>
            <StepEditorNav
              sections={STEP_EDITOR_SECTIONS}
              activeSection={activeSection}
              onChange={setActiveSection}
              isCompact={isFocusMode}
              layout="horizontal"
            />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
