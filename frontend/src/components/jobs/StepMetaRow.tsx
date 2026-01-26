import { useEffect, useRef } from "react";
import { PencilIcon } from "@heroicons/react/24/outline";
import { MergedStep, StepStatus } from "@/types/job";
import type {
  AIModel,
  ImageGenerationSettings,
  ReasoningEffort,
  ServiceTier,
  Tool as WorkflowTool,
} from "@/types/workflow";
import { StepMetaBadges } from "@/components/jobs/StepMetaBadges";
import {
  ContextPanel,
  ImageSettingsPanel,
  ModelDetailsPanel,
  ReasoningDetailsPanel,
  SpeedDetailsPanel,
  ToolsPanel,
} from "@/components/jobs/panels";
import type { EditablePanel } from "@/components/jobs/StepMetaTypes";
import { useStepMetaRow } from "@/hooks/useStepMetaRow";

type StepMetaUpdate = {
  model?: AIModel | null;
  service_tier?: ServiceTier | null;
  reasoning_effort?: ReasoningEffort | null;
  image_generation?: ImageGenerationSettings;
  tools?: WorkflowTool[] | null;
  instructions?: string | null;
};

interface StepMetaRowProps {
  step: MergedStep;
  status: StepStatus;
  allSteps?: MergedStep[];
  canEdit?: boolean;
  onEditStep?: (stepIndex: number) => void;
  onQuickUpdateStep?: (stepIndex: number, update: StepMetaUpdate) => Promise<void>;
  updatingStepIndex?: number | null;
  jobStatus?: string;
}

export function StepMetaRow({
  step,
  status,
  allSteps,
  canEdit = false,
  onEditStep,
  onQuickUpdateStep,
  updatingStepIndex,
  jobStatus,
}: StepMetaRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const {
    openPanel,
    setOpenPanel,
    setEditPanel,
    editPanel,
    draftModel,
    setDraftModel,
    draftServiceTier,
    setDraftServiceTier,
    draftReasoningEffort,
    setDraftReasoningEffort,
    draftImageSettings,
    handleDraftImageSettingsChange,
    draftInstructions,
    setDraftInstructions,
    draftTools,
    setDraftTools,
    showContext,
    showImageSettings,
    showModelDetails,
    showSpeedDetails,
    showReasoningDetails,
    showTools,
    togglePanel,
    instructions,
    contextId,
    toolsId,
    imageSettingsId,
    modelDetailsId,
    speedDetailsId,
    reasoningDetailsId,
    toolList,
    hasImageGenerationTool,
    showEditIcon,
    editDisabled,
    isUpdating,
    modelValue,
    modelDetailsRows,
    dependencyPreviews,
    hasDependencies,
    hasContext,
    hasTools,
    toolDetails,
    modelRestriction,
    speedCount,
    speedLabel,
    speedBadgeClass,
    reasoningCount,
    reasoningLabel,
    reasoningBadgeClass,
    speedDetailsRows,
    reasoningDetailsRows,
    contextButtonClass,
    isModelDirty,
    isModelAllowed,
    isServiceTierDirty,
    isReasoningDirty,
    startEditing,
    handleCancelEdit,
    handleSaveEdit,
    imageSettingsSource,
    toolChoice,
    imageSettingsRows,
    isImageSettingsDirty,
    isInstructionsDirty,
    isToolsDirty,
    modelBadgeClass,
    isInProgress,
  } = useStepMetaRow({
    step,
    status,
    allSteps,
    canEdit,
    onEditStep,
    onQuickUpdateStep,
    updatingStepIndex,
  });

  const renderEditButton = (panel: EditablePanel) => {
    if (!showEditIcon) return null;
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          startEditing(panel);
        }}
        disabled={editDisabled}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-background/70 text-muted-foreground transition-colors ${
          editDisabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:text-foreground hover:bg-muted/40"
        }`}
        aria-label={editDisabled ? "Editing locked" : "Edit step"}
        title={editDisabled ? "Editing locked" : "Edit step"}
      >
        <PencilIcon className="h-3.5 w-3.5" />
      </button>
    );
  };

  const badgeProps = {
    modelValue,
    showModelDetails,
    modelDetailsId,
    modelBadgeClass,
    onToggleModel: () => togglePanel("model"),
    speedCount,
    speedLabel,
    speedBadgeClass,
    showSpeedDetails,
    speedDetailsId,
    onToggleSpeed: () => togglePanel("speed"),
    reasoningCount,
    reasoningLabel,
    reasoningBadgeClass,
    showReasoningDetails,
    reasoningDetailsId,
    onToggleReasoning: () => togglePanel("reasoning"),
    hasTools,
    toolList,
    hasImageGenerationTool,
    showImageSettings,
    imageSettingsId,
    onToggleImage: () => togglePanel("image"),
    showTools,
    toolsId,
    onToggleTools: () => togglePanel("tools"),
    hasContext,
    showContext,
    contextId,
    contextButtonClass,
    dependencyCount: dependencyPreviews.length,
    onToggleContext: () => togglePanel("context"),
    isInProgress,
    status,
  };

  const modelPanelProps = {
    id: modelDetailsId,
    editPanel,
    draftModel,
    onDraftModelChange: setDraftModel,
    modelRestriction,
    renderEditButton,
    onCancel: handleCancelEdit,
    onSave: handleSaveEdit,
    isUpdating,
    isModelDirty,
    isModelAllowed,
    modelDetailsRows,
  };
  const speedPanelProps = {
    id: speedDetailsId,
    editPanel,
    draftServiceTier,
    onDraftServiceTierChange: setDraftServiceTier,
    renderEditButton,
    onCancel: handleCancelEdit,
    onSave: handleSaveEdit,
    isUpdating,
    isServiceTierDirty,
    speedDetailsRows,
  };
  const reasoningPanelProps = {
    id: reasoningDetailsId,
    editPanel,
    draftReasoningEffort,
    onDraftReasoningEffortChange: setDraftReasoningEffort,
    renderEditButton,
    onCancel: handleCancelEdit,
    onSave: handleSaveEdit,
    isUpdating,
    isReasoningDirty,
    reasoningDetailsRows,
  };
  const imagePanelProps = {
    id: imageSettingsId,
    imageSettingsSource,
    toolChoice,
    imageSettingsRows,
    editPanel,
    draftImageSettings,
    onDraftImageSettingsChange: handleDraftImageSettingsChange,
    renderEditButton,
    onCancel: handleCancelEdit,
    onSave: handleSaveEdit,
    isUpdating,
    isImageSettingsDirty,
  };
  const toolsPanelProps = {
    id: toolsId,
    toolDetails,
    editPanel,
    draftTools,
    onDraftToolsChange: setDraftTools,
    renderEditButton,
    onCancel: handleCancelEdit,
    onSave: handleSaveEdit,
    isUpdating,
    isToolsDirty,
  };

  const contextPanelProps = {
    id: contextId,
    dependencyPreviews,
    instructions,
    editPanel,
    draftInstructions,
    onDraftInstructionsChange: setDraftInstructions,
    renderEditButton,
    onCancel: handleCancelEdit,
    onSave: handleSaveEdit,
    isUpdating,
    isInstructionsDirty: isInstructionsDirty,
  };

  useEffect(() => {
    if (!openPanel) {
      setEditPanel(null);
      return;
    }

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target || !containerRef.current) return;
      if (containerRef.current.contains(target)) return;
      setOpenPanel(null);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [openPanel, setEditPanel, setOpenPanel]);

  return (
    <div className="space-y-2 w-full min-w-0 max-w-full" ref={containerRef}>
      <StepMetaBadges {...badgeProps} />
      {showModelDetails && <ModelDetailsPanel {...modelPanelProps} />}
      {showSpeedDetails && <SpeedDetailsPanel {...speedPanelProps} />}
      {showReasoningDetails && (
        <ReasoningDetailsPanel {...reasoningPanelProps} />
      )}
      {hasTools && showTools && (
        <ToolsPanel {...toolsPanelProps} />
      )}
      {hasImageGenerationTool && showImageSettings && (
        <ImageSettingsPanel {...imagePanelProps} />
      )}
      {hasContext && showContext && <ContextPanel {...contextPanelProps} />}
    </div>
  );
}
