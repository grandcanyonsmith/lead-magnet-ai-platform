"use client";

import React, { useEffect, useState } from "react";
import {
  FiTrash2,
  FiChevronUp,
  FiChevronDown,
  FiMaximize2,
  FiZap,
} from "react-icons/fi";
import { useWorkflowStepAI } from "@/hooks/useWorkflowStepAI";
import { WorkflowStep } from "@/types/workflow";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { CollapsibleSection } from "@/components/workflows/edit/CollapsibleSection";

import AIAssist from "./step-editor/AIAssist";
import WebhookConfig from "./step-editor/WebhookConfig";
import HandoffConfig from "./step-editor/HandoffConfig";
import StepTester from "./step-editor/StepTester";
import StepEditorNav from "./step-editor/StepEditorNav";
import StepSummary from "./step-editor/StepSummary";

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

type StepEditorSectionId = (typeof STEP_EDITOR_SECTIONS)[number]["id"];

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
  const [isWebhookCollapsed, setIsWebhookCollapsed] = useState(true);
  const [isHandoffCollapsed, setIsHandoffCollapsed] = useState(true);

  // Always call hook unconditionally to comply with Rules of Hooks
  const workflowStepAI = useWorkflowStepAI(workflowId);

  const handleToggleFocusMode = () => {
    setIsFocusMode((current) => !current);
  };

  // Reset section state when switching steps.
  useEffect(() => {
    setActiveSection("basics");
    setIsFocusMode(false);
    setIsWebhookCollapsed(true);
    setIsHandoffCollapsed(true);
  }, [index]);

  const isWebhookConfigured = Boolean(
    (localStep.webhook_url && localStep.webhook_url.trim()) ||
      localStep.step_type === "webhook",
  );
  const isHandoffConfigured = Boolean(
    localStep.handoff_workflow_id && localStep.handoff_workflow_id.trim(),
  );
  const toolCount = Array.isArray(localStep.tools) ? localStep.tools.length : 0;
  const dependencyCount = Array.isArray(localStep.depends_on)
    ? localStep.depends_on.length
    : 0;
  const instructionsLength = localStep.instructions?.trim().length || 0;
  const hasInstructions = instructionsLength > 0;
  const isStepReady = Boolean(
    localStep.step_name.trim() && hasInstructions && localStep.model,
  );

  const integrationSummary = isWebhookConfigured && isHandoffConfigured
    ? "Webhook and handoff configured"
    : isWebhookConfigured
      ? "Webhook configured"
      : isHandoffConfigured
        ? "Handoff configured"
        : "Standalone step";

  const activeSectionMeta =
    STEP_EDITOR_SECTIONS.find((section) => section.id === activeSection) ||
    STEP_EDITOR_SECTIONS[0];
  const ActiveSectionIcon = activeSectionMeta.icon;

  const overviewStats = [
    {
      label: "Instructions",
      value: hasInstructions
        ? `${instructionsLength.toLocaleString()} characters`
        : "Not written yet",
      tone: hasInstructions ? "highlight" : "warning",
    },
    {
      label: "Tools",
      value: toolCount > 0 ? `${toolCount} enabled` : "No tools enabled",
      tone: toolCount > 0 ? "highlight" : "default",
    },
    {
      label: "Dependencies",
      value:
        dependencyCount > 0
          ? `${dependencyCount} linked`
          : "No upstream data linked",
      tone: dependencyCount > 0 ? "highlight" : "default",
    },
    {
      label: "Integrations",
      value: integrationSummary,
      tone:
        isWebhookConfigured || isHandoffConfigured ? "highlight" : "default",
    },
  ] as const;

  const setupItems = [
    {
      label: "Step details",
      detail: localStep.step_name.trim() || "Name this step",
      complete: Boolean(localStep.step_name.trim()),
      sectionId: "basics" as StepEditorSectionId,
    },
    {
      label: "Instructions",
      detail: hasInstructions
        ? `${instructionsLength.toLocaleString()} characters`
        : "Add the prompt this step should follow",
      complete: hasInstructions,
      sectionId: "instructions" as StepEditorSectionId,
    },
    {
      label: "AI settings",
      detail: localStep.model || "Choose a model",
      complete: Boolean(localStep.model),
      sectionId: "model" as StepEditorSectionId,
    },
    {
      label: "Tools & data",
      detail:
        toolCount > 0 || dependencyCount > 0
          ? [
              toolCount > 0 ? `${toolCount} tools` : null,
              dependencyCount > 0 ? `${dependencyCount} dependencies` : null,
            ]
              .filter(Boolean)
              .join(" • ")
          : "No tools or dependencies configured",
      complete: toolCount > 0 || dependencyCount > 0,
      sectionId: "tools" as StepEditorSectionId,
    },
    {
      label: "Integrations",
      detail: integrationSummary,
      complete: isWebhookConfigured || isHandoffConfigured,
      sectionId: "integrations" as StepEditorSectionId,
    },
  ];

  const completedSetupCount = setupItems.filter((item) => item.complete).length;

  const activeSectionStatus = (() => {
    switch (activeSection) {
      case "basics":
        return {
          label: localStep.step_name.trim() ? "Named" : "Needs attention",
          variant: localStep.step_name.trim() ? "success" : "warning",
        } as const;
      case "instructions":
        return {
          label: hasInstructions
            ? `${instructionsLength.toLocaleString()} chars`
            : "Prompt missing",
          variant: hasInstructions ? "success" : "warning",
        } as const;
      case "model":
        return {
          label: localStep.model ? "Configured" : "Needs attention",
          variant: localStep.model ? "success" : "warning",
        } as const;
      case "tools":
        return {
          label:
            toolCount > 0
              ? `${toolCount} tools enabled`
              : dependencyCount > 0
                ? `${dependencyCount} dependencies linked`
                : "Optional",
          variant:
            toolCount > 0 || dependencyCount > 0 ? "success" : "secondary",
        } as const;
      case "integrations":
        return {
          label: integrationSummary,
          variant:
            isWebhookConfigured || isHandoffConfigured
              ? "success"
              : "secondary",
        } as const;
      case "refine":
        return {
          label: workflowId ? "Ready to test" : "Save to unlock AI assist",
          variant: workflowId ? "success" : "warning",
        } as const;
      default:
        return {
          label: "Configure this section",
          variant: "secondary",
        } as const;
    }
  })();

  const positionLabel =
    index === 0
      ? "This is the first step in the flow."
      : index === totalSteps - 1
        ? "This is the final step in the flow."
        : `This runs after Step ${index} and before Step ${index + 2}.`;

  const roleLabel = localStep.is_deliverable
    ? "Customer-facing deliverable"
    : isWebhookConfigured || isHandoffConfigured
      ? "Integration / automation step"
      : "Internal processing step";

  const renderSectionContent = () => {
    if (activeSection === "basics") {
      return (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <StepBasics
            step={localStep}
            index={index}
            onChange={handleChange}
            isFocusMode={isFocusMode}
          />
          <div className="rounded-xl border border-border/50 bg-muted/10 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h5 className="text-sm font-semibold text-foreground">
                  Editing guidance
                </h5>
                <p className="mt-1 text-sm text-muted-foreground">
                  Keep the name scannable in the flowchart and save detailed
                  execution logic for the instructions section.
                </p>
              </div>
              <Badge variant={isStepReady ? "success" : "warning"}>
                {isStepReady ? "Ready" : "Incomplete"}
              </Badge>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-background/70 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Position
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  {positionLabel}
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/70 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Role
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  {roleLabel}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeSection === "instructions") {
      return (
        <InstructionsEditor
          step={localStep}
          index={index}
          onChange={handleChange}
          isFocusMode={isFocusMode}
        />
      );
    }

    if (activeSection === "model") {
      return (
        <div className="grid gap-6 xl:grid-cols-2">
          <ModelConfig step={localStep} index={index} onChange={handleChange} />
          <OutputSettings
            step={localStep}
            index={index}
            onChange={handleChange}
          />
        </div>
      );
    }

    if (activeSection === "tools") {
      return (
        <div className="space-y-6">
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
      );
    }

    if (activeSection === "integrations") {
      return (
        <div className="space-y-6">
          <div className="grid gap-3 lg:grid-cols-2">
            <button
              type="button"
              onClick={() => setIsWebhookCollapsed((collapsed) => !collapsed)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                isWebhookConfigured
                  ? "border-primary/30 bg-primary/5"
                  : "border-border/60 bg-muted/10 hover:bg-muted/20",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    Webhook / API Request
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Send step data to an external endpoint.
                  </p>
                </div>
                <Badge variant={isWebhookConfigured ? "success" : "secondary"}>
                  {isWebhookConfigured ? "Configured" : "Not set"}
                </Badge>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIsHandoffCollapsed((collapsed) => !collapsed)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                isHandoffConfigured
                  ? "border-primary/30 bg-primary/5"
                  : "border-border/60 bg-muted/10 hover:bg-muted/20",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    Lead Magnet Handoff
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Send this step&apos;s output to another workflow.
                  </p>
                </div>
                <Badge variant={isHandoffConfigured ? "success" : "secondary"}>
                  {isHandoffConfigured ? "Configured" : "Not set"}
                </Badge>
              </div>
            </button>
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
        </div>
      );
    }

    return (
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-purple-200/60 bg-purple-50/30 p-5 dark:border-purple-900/60 dark:bg-purple-950/20">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-purple-100 p-2.5 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300">
                <FiZap className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h5 className="text-sm font-semibold text-foreground">
                  AI Assist
                </h5>
                <p className="mt-1 text-sm text-muted-foreground">
                  Describe the change you want, then review the proposed diff
                  before applying it.
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className="border-purple-200 text-purple-700 dark:border-purple-800 dark:text-purple-300"
            >
              Beta
            </Badge>
          </div>
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
        </div>

        <div className="space-y-3">
          <div>
            <h5 className="text-sm font-semibold text-foreground">
              Step tester
            </h5>
            <p className="mt-1 text-sm text-muted-foreground">
              Run this step in isolation with sample JSON input and inspect the
              output before saving the full workflow.
            </p>
          </div>
          <StepTester key={index} step={localStep} index={index} />
        </div>
      </div>
    );
  };

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
      <div className="space-y-6">
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/5">
          <div className="border-b border-border/60 bg-gradient-to-br from-muted/20 via-background to-muted/5 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Step {index + 1} of {totalSteps}</Badge>
                  {localStep.is_deliverable && (
                    <Badge variant="success">Deliverable</Badge>
                  )}
                  {isWebhookConfigured && <Badge variant="outline">Webhook</Badge>}
                  {isHandoffConfigured && <Badge variant="outline">Handoff</Badge>}
                  {isFocusMode && <Badge variant="outline">Focus mode</Badge>}
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-foreground">
                    Quick summary
                  </div>
                  <StepSummary step={localStep} isFocusMode={isFocusMode} />
                  <p className="max-w-3xl text-sm text-muted-foreground">
                    {localStep.step_description ||
                      "Edit this step by section instead of hunting through one long form. Jump between prompt, model, tools, integrations, and testing as needed."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 xl:justify-end">
                <Button
                  type="button"
                  variant={isFocusMode ? "default" : "outline"}
                  size="sm"
                  onClick={handleToggleFocusMode}
                  className="gap-2"
                  aria-pressed={isFocusMode}
                >
                  <FiMaximize2 className="h-4 w-4" aria-hidden />
                  {isFocusMode ? "Exit Focus" : "Focus Mode"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => onMoveUp(index)}
                  disabled={index === 0}
                  aria-label="Move step up"
                >
                  <FiChevronUp className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => onMoveDown(index)}
                  disabled={index === totalSteps - 1}
                  aria-label="Move step down"
                >
                  <FiChevronDown className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => onDelete(index)}
                  className="border-destructive/30 text-destructive hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete step"
                >
                  <FiTrash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
            {overviewStats.map((stat) => (
              <div
                key={stat.label}
                className={cn(
                  "rounded-xl border px-4 py-3",
                  stat.tone === "warning"
                    ? "border-amber-500/30 bg-amber-500/5"
                    : stat.tone === "highlight"
                      ? "border-primary/20 bg-primary/5"
                      : "border-border/60 bg-background/70",
                )}
              >
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {stat.label}
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className={cn(
            "grid gap-6",
            isFocusMode ? "grid-cols-1" : "xl:grid-cols-[300px_minmax(0,1fr)]",
          )}
        >
          {!isFocusMode && (
            <aside className="space-y-4 xl:sticky xl:top-6 self-start">
              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      Setup status
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Click any row to jump straight to that part of the editor.
                    </p>
                  </div>
                  <Badge variant={isStepReady ? "success" : "warning"}>
                    {completedSetupCount}/{setupItems.length}
                  </Badge>
                </div>
                <div className="mt-4 space-y-2">
                  {setupItems.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setActiveSection(item.sectionId)}
                      className={cn(
                        "flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                        activeSection === item.sectionId
                          ? "border-primary/30 bg-primary/5"
                          : "border-border/60 bg-background/60 hover:bg-muted/20",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">
                          {item.label}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item.detail}
                        </div>
                      </div>
                      <Badge
                        variant={item.complete ? "success" : "secondary"}
                        className="shrink-0"
                      >
                        {item.complete ? "Done" : "Open"}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
                <StepEditorNav
                  sections={STEP_EDITOR_SECTIONS}
                  activeSection={activeSection}
                  onChange={setActiveSection}
                  layout="vertical"
                />
              </div>
            </aside>
          )}

          <div className="space-y-6">
            {isFocusMode && (
              <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
                <StepEditorNav
                  sections={STEP_EDITOR_SECTIONS}
                  activeSection={activeSection}
                  onChange={setActiveSection}
                  isCompact
                  layout="horizontal"
                />
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
              <div className="border-b border-border/60 px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/20 text-foreground">
                      <ActiveSectionIcon className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-lg font-semibold text-foreground">
                        {activeSectionMeta.label}
                      </h4>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {activeSectionMeta.description}
                      </p>
                    </div>
                  </div>
                  <Badge variant={activeSectionStatus.variant} className="w-fit">
                    {activeSectionStatus.label}
                  </Badge>
                </div>
              </div>
              <div className="p-5 sm:p-6">{renderSectionContent()}</div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
