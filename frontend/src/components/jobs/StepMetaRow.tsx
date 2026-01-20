import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Brain, ChevronDown, ChevronUp, Pencil, Zap } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { AI_MODELS, DEFAULT_AI_MODEL } from "@/constants/models";
import { MergedStep, StepStatus } from "@/types/job";
import type { AIModel, ReasoningEffort, ServiceTier } from "@/types/workflow";
import {
  extractReasoningEffort,
  extractServiceTier,
  getToolName,
  REASONING_EFFORT_LABELS,
  REASONING_EFFORT_LEVELS,
  SERVICE_TIER_LABELS,
  SERVICE_TIER_SPEED,
  type Tool,
} from "@/utils/stepMeta";

type BadgeIcon = ComponentType<{ className?: string }>;

type EditablePanel = "model" | "speed" | "reasoning";
type ReasoningEffortOption = ReasoningEffort | "auto";
type StepMetaUpdate = {
  model?: AIModel | null;
  service_tier?: ServiceTier | null;
  reasoning_effort?: ReasoningEffort | null;
};
type DetailRow = {
  label: string;
  value: string;
  muted?: boolean;
};

const DEFAULT_IMAGE_SETTINGS = {
  model: "gpt-image-1.5",
  size: "auto",
  quality: "auto",
  background: "auto",
} as const;

const HOVER_CHEVRON_CLASS =
  "opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const getStringValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

const getNumberValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const hasImageOverrides = (config: Record<string, unknown>): boolean => {
  const model = getStringValue(config.model);
  if (model && model !== DEFAULT_IMAGE_SETTINGS.model) return true;
  const size = getStringValue(config.size);
  if (size && size !== DEFAULT_IMAGE_SETTINGS.size) return true;
  const quality = getStringValue(config.quality);
  if (quality && quality !== DEFAULT_IMAGE_SETTINGS.quality) return true;
  const background = getStringValue(config.background);
  if (background && background !== DEFAULT_IMAGE_SETTINGS.background) return true;
  if (getStringValue(config.format)) return true;
  if (config.compression !== undefined && config.compression !== null) return true;
  if (getStringValue(config.input_fidelity)) return true;
  return false;
};

// Render tool badges inline
function renderToolBadges({
  tools,
  onImageToggle,
  imageExpanded,
  imageControlsId,
  onToolsToggle,
  toolsExpanded,
  toolsControlsId,
}: {
  tools?: string[] | unknown[];
  onImageToggle?: () => void;
  imageExpanded?: boolean;
  imageControlsId?: string;
  onToolsToggle?: () => void;
  toolsExpanded?: boolean;
  toolsControlsId?: string;
}) {
  if (!tools || !Array.isArray(tools) || tools.length === 0) {
    return (
      <span className="px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
        None
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {tools.map((tool, toolIdx) => {
        const toolName = getToolName(tool as Tool);
        const isImageTool = toolName === "image_generation";
        const baseClass =
          "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md border whitespace-nowrap";
        const defaultBadgeClass = `${baseClass} bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800/60`;
        const imageBadgeClass = `${baseClass} bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-200 dark:border-indigo-800/60`;
        const imageActiveClass = imageExpanded
          ? "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/60 dark:text-indigo-100 dark:border-indigo-700/60"
          : "hover:bg-indigo-100 dark:hover:bg-indigo-900/50";
        const buttonClass = `${imageBadgeClass} ${imageActiveClass} transition-all cursor-pointer shadow-sm hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-1 dark:focus-visible:ring-indigo-700 group`;

        if (isImageTool && onImageToggle) {
          const ToggleIcon = imageExpanded ? ChevronUp : ChevronDown;
          return (
            <button
              key={toolIdx}
              type="button"
              onClick={onImageToggle}
              aria-expanded={imageExpanded}
              aria-controls={imageControlsId}
              aria-pressed={imageExpanded}
              className={buttonClass}
              title="Toggle image generation settings"
            >
              <span>{toolName}</span>
              <ToggleIcon
                className={`h-3 w-3 ${HOVER_CHEVRON_CLASS}`}
                aria-hidden="true"
              />
            </button>
          );
        }
        if (onToolsToggle) {
          const ToggleIcon = toolsExpanded ? ChevronUp : ChevronDown;
          return (
            <button
              key={toolIdx}
              type="button"
              onClick={onToolsToggle}
              aria-expanded={toolsExpanded}
              aria-controls={toolsControlsId}
              aria-pressed={toolsExpanded}
              className={`${defaultBadgeClass} transition-all cursor-pointer shadow-sm hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-1 dark:focus-visible:ring-slate-700 group`}
              title="Toggle tool details"
            >
              <span>{toolName}</span>
              <ToggleIcon
                className={`h-3 w-3 ${HOVER_CHEVRON_CLASS}`}
                aria-hidden="true"
              />
            </button>
          );
        }
        return (
          <span
            key={toolIdx}
            className={defaultBadgeClass}
          >
            {toolName}
          </span>
        );
      })}
    </div>
  );
}

function getToolDisplayName(tool: Tool): string {
  if (typeof tool === "string") return tool;
  if (!tool || typeof tool !== "object") return "unknown";
  const record = tool as Record<string, unknown>;
  const functionName =
    record.function &&
    typeof record.function === "object" &&
    typeof (record.function as { name?: unknown }).name === "string"
      ? String((record.function as { name?: unknown }).name)
      : null;
  if (functionName && functionName.trim()) {
    return functionName;
  }
  if (typeof record.name === "string" && record.name.trim()) {
    return record.name;
  }
  return getToolName(tool);
}

function renderIconBadge({
  count,
  Icon,
  label,
  className,
  iconClassName,
  showChevron = false,
  chevronClassName,
  onClick,
  isExpanded,
  controlsId,
}: {
  count: number;
  Icon: BadgeIcon;
  label: string;
  className: string;
  iconClassName: string;
  showChevron?: boolean;
  chevronClassName?: string;
  onClick?: () => void;
  isExpanded?: boolean;
  controlsId?: string;
}) {
  if (!count || count < 1) return null;
  const ChevronIcon = isExpanded ? ChevronUp : ChevronDown;
  const content = (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <Icon key={`${label}-${idx}`} className={iconClassName} aria-hidden="true" />
      ))}
      {showChevron && (
        <ChevronIcon
          className={chevronClassName || "h-3 w-3 text-current/70"}
          aria-hidden="true"
        />
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-expanded={isExpanded}
        aria-controls={controlsId}
        aria-pressed={isExpanded}
        aria-label={label}
        title={label}
        className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 ${className} cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-1`}
      >
        {content}
      </button>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 ${className}`}
      role="img"
      aria-label={label}
      title={label}
    >
      {content}
    </span>
  );
}

function DetailRows({ rows }: { rows: DetailRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between rounded-md border border-border/60 bg-background/70 px-2 py-1"
        >
          <span className="text-[11px] font-medium text-muted-foreground">
            {row.label}
          </span>
          <span
            className={`text-[11px] font-semibold ${
              row.muted ? "text-muted-foreground" : "text-foreground"
            }`}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

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

type MetaPanel = "context" | "image" | "model" | "speed" | "reasoning" | "tools";

const getOutputText = (value: unknown) => {
  if (value === null || value === undefined) return "No output yet";
  if (typeof value === "string") {
    return value.trim() || "No output yet";
  }
  const text = JSON.stringify(value, null, 2);
  return text || "No output yet";
};

const isMarkdownLike = (value: string) =>
  /(^|\n)#{1,6}\s/.test(value) ||
  /```/.test(value) ||
  /\*\*[^*]+\*\*/.test(value) ||
  /__[^_]+__/.test(value) ||
  /(^|\n)\s*[-*+]\s+/.test(value) ||
  /(^|\n)\s*\d+\.\s+/.test(value) ||
  /\[[^\]]+\]\([^)]+\)/.test(value);

const renderDependencyOutputPreview = (value: unknown) => {
  const preview = getOutputText(value);
  if (typeof preview === "string" && isMarkdownLike(preview)) {
    return (
      <MarkdownRenderer
        value={preview}
        className="prose prose-sm max-w-none text-[11px] leading-snug text-foreground/90 dark:prose-invert prose-p:my-1 prose-headings:my-1 prose-li:my-0 prose-pre:my-1 prose-pre:overflow-x-auto"
        fallbackClassName="whitespace-pre-wrap break-words text-[11px] leading-snug"
      />
    );
  }

  return <pre className="whitespace-pre-wrap break-words">{preview}</pre>;
};

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
  const isInProgress = status === "in_progress";
  const [openPanel, setOpenPanel] = useState<MetaPanel | null>(null);
  const [editPanel, setEditPanel] = useState<EditablePanel | null>(null);
  const [draftModel, setDraftModel] = useState<AIModel>(DEFAULT_AI_MODEL);
  const [draftServiceTier, setDraftServiceTier] = useState<ServiceTier>("auto");
  const [draftReasoningEffort, setDraftReasoningEffort] =
    useState<ReasoningEffortOption>("auto");
  const showContext = openPanel === "context";
  const showImageSettings = openPanel === "image";
  const showModelDetails = openPanel === "model";
  const showSpeedDetails = openPanel === "speed";
  const showReasoningDetails = openPanel === "reasoning";
  const showTools = openPanel === "tools";
  const togglePanel = (panel: MetaPanel) =>
    setOpenPanel((prev) => (prev === panel ? null : panel));
  const containerRef = useRef<HTMLDivElement>(null);
  const instructions = step.instructions?.trim();
  const stepOrderId = step.step_order ?? "unknown";
  const contextId = `step-context-${stepOrderId}`;
  const toolsId = `step-tools-${stepOrderId}`;
  const imageSettingsId = `step-image-settings-${stepOrderId}`;
  const modelDetailsId = `step-model-details-${stepOrderId}`;
  const speedDetailsId = `step-speed-details-${stepOrderId}`;
  const reasoningDetailsId = `step-reasoning-details-${stepOrderId}`;
  const inputRecord = isRecord(step.input) ? step.input : null;
  const tools = Array.isArray(step.input?.tools)
    ? step.input?.tools
    : step.tools;
  const toolList = Array.isArray(tools) ? tools : [];
  const imageTool = toolList.find(
    (tool) => getToolName(tool as Tool) === "image_generation",
  );
  const imageToolConfig = isRecord(imageTool) ? imageTool : null;
  const hasImageGenerationTool = Boolean(imageTool);
  const isSystemStep =
    step.step_type === "form_submission" || step.step_type === "final_output";
  const editHandlerAvailable = Boolean(onQuickUpdateStep || onEditStep);
  const canEditStep =
    Boolean(canEdit && editHandlerAvailable) &&
    !isSystemStep &&
    step.step_order !== undefined &&
    step.step_order > 0;
  const showEditIcon = Boolean(canEdit && editHandlerAvailable);
  const editDisabled = jobStatus === "processing" || !canEditStep;
  const stepIndex =
    step.step_order !== undefined ? step.step_order - 1 : null;
  const isUpdating = stepIndex !== null && updatingStepIndex === stepIndex;
  const toolChoice =
    getStringValue(step.input?.tool_choice) || getStringValue(step.tool_choice);
  const modelFromStep = getStringValue(step.model);
  const modelFromInput = getStringValue(inputRecord?.model);
  const usageModel = getStringValue(step.usage_info?.model);
  const modelValue =
    modelFromStep || modelFromInput || usageModel || "Unknown";
  const modelDetailsRows: DetailRow[] = [
    { label: "Model", value: modelValue, muted: modelValue === "Unknown" },
  ];
  if (usageModel && usageModel !== modelValue) {
    modelDetailsRows.push({ label: "Usage model", value: usageModel });
  }
  const dependencyItems =
    step.depends_on?.map((dep, idx) => ({
      index: dep,
      label: step.dependency_labels?.[idx] || `Step ${dep + 1}`,
    })) || [];
  const dependencyPreviews = dependencyItems
    .map((dependency) => ({
      dependency,
      step: allSteps?.find(
        (candidate) => candidate.step_order === dependency.index + 1,
      ),
    }))
    .filter(
      (
        item,
      ): item is { dependency: typeof dependencyItems[number]; step: MergedStep } =>
        Boolean(item.step),
    );
  const hasDependencies = dependencyPreviews.length > 0;
  const hasContext = Boolean(instructions) || hasDependencies;
  const hasTools = toolList.length > 0;
  const toolDetails = useMemo(
    () =>
      toolList.map((tool, index) => {
        if (typeof tool === "string") {
          return {
            id: `${tool}-${index}`,
            name: tool,
            config: null as Record<string, unknown> | null,
          };
        }
        if (tool && typeof tool === "object") {
          const toolValue = tool as Tool;
          const record = toolValue as Record<string, unknown>;
          const { type: _type, name: _name, ...rest } = record;
          const config = Object.keys(rest).length > 0 ? rest : null;
          const displayName = getToolDisplayName(toolValue);
          return {
            id: `${displayName}-${index}`,
            name: displayName,
            config,
          };
        }
        return {
          id: `unknown-${index}`,
          name: "unknown",
          config: null as Record<string, unknown> | null,
        };
      }),
    [toolList],
  );
  const serviceTier = extractServiceTier(step);
  const normalizedServiceTier = serviceTier?.toLowerCase();
  const speedCount =
    normalizedServiceTier && normalizedServiceTier !== "auto"
      ? SERVICE_TIER_SPEED[normalizedServiceTier]
      : undefined;
  const speedLabel = normalizedServiceTier
    ? SERVICE_TIER_LABELS[normalizedServiceTier]
    : undefined;
  const stepServiceTier = getStringValue(
    (step as { service_tier?: unknown }).service_tier,
  );
  const inputServiceTier = getStringValue(inputRecord?.service_tier);
  const serviceTierValue = normalizedServiceTier || "auto";
  const serviceTierLabel = speedLabel || "Auto";
  const reasoningEffort = extractReasoningEffort(step);
  const normalizedReasoningEffort = reasoningEffort?.toLowerCase();
  const reasoningCount = normalizedReasoningEffort
    ? REASONING_EFFORT_LEVELS[normalizedReasoningEffort]
    : undefined;
  const reasoningLabel = normalizedReasoningEffort
    ? REASONING_EFFORT_LABELS[normalizedReasoningEffort]
    : undefined;
  const stepReasoningEffort = getStringValue(
    (step as { reasoning_effort?: unknown }).reasoning_effort,
  );
  const inputReasoningEffort = getStringValue(inputRecord?.reasoning_effort);
  const inputReasoningNested = isRecord(inputRecord?.reasoning)
    ? getStringValue((inputRecord.reasoning as Record<string, unknown>).effort)
    : null;
  const reasoningValue = normalizedReasoningEffort || "auto";
  const reasoningLabelValue = reasoningLabel || "Auto";
  const resolvedModel = (modelFromStep ||
    modelFromInput ||
    usageModel ||
    DEFAULT_AI_MODEL) as AIModel;
  const resolvedServiceTier = (serviceTierValue || "auto") as ServiceTier;
  const resolvedReasoningEffort = (reasoningValue ||
    "auto") as ReasoningEffortOption;
  const isModelDirty = draftModel !== resolvedModel;
  const isServiceTierDirty = draftServiceTier !== resolvedServiceTier;
  const isReasoningDirty = draftReasoningEffort !== resolvedReasoningEffort;

  const startEditing = (panel: EditablePanel) => {
    if (editDisabled) return;
    if (!onQuickUpdateStep && onEditStep && stepIndex !== null) {
      onEditStep(stepIndex);
      return;
    }
    setOpenPanel(panel);
    setEditPanel(panel);
    if (panel === "model") {
      setDraftModel(resolvedModel);
    }
    if (panel === "speed") {
      setDraftServiceTier(resolvedServiceTier);
    }
    if (panel === "reasoning") {
      setDraftReasoningEffort(resolvedReasoningEffort);
    }
  };

  const handleCancelEdit = () => {
    setEditPanel(null);
  };

  const handleSaveEdit = async () => {
    if (!onQuickUpdateStep || stepIndex === null || !editPanel) return;
    const update: StepMetaUpdate = {};
    if (editPanel === "model") {
      update.model = draftModel;
    }
    if (editPanel === "speed") {
      update.service_tier =
        draftServiceTier === "auto" ? null : draftServiceTier;
    }
    if (editPanel === "reasoning") {
      update.reasoning_effort =
        draftReasoningEffort === "auto" ? null : draftReasoningEffort;
    }
    await onQuickUpdateStep(stepIndex, update);
    setEditPanel(null);
  };

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
        <Pencil className="h-3.5 w-3.5" />
      </button>
    );
  };
  const imageSettings = {
    model: getStringValue(imageToolConfig?.model) || DEFAULT_IMAGE_SETTINGS.model,
    size: getStringValue(imageToolConfig?.size) || DEFAULT_IMAGE_SETTINGS.size,
    quality:
      getStringValue(imageToolConfig?.quality) || DEFAULT_IMAGE_SETTINGS.quality,
    background:
      getStringValue(imageToolConfig?.background) ||
      DEFAULT_IMAGE_SETTINGS.background,
    format: getStringValue(imageToolConfig?.format),
    compression: getNumberValue(imageToolConfig?.compression),
    inputFidelity: getStringValue(imageToolConfig?.input_fidelity),
  };
  const imageHasOverrides = imageToolConfig
    ? hasImageOverrides(imageToolConfig)
    : false;
  const imageSettingsSource = imageHasOverrides ? "Custom" : "Defaults";
  const imageSettingsRows = [
    {
      label: "Model",
      value: imageSettings.model,
      highlighted: imageSettings.model !== DEFAULT_IMAGE_SETTINGS.model,
    },
    {
      label: "Size",
      value: imageSettings.size,
      highlighted: imageSettings.size !== DEFAULT_IMAGE_SETTINGS.size,
    },
    {
      label: "Quality",
      value: imageSettings.quality,
      highlighted: imageSettings.quality !== DEFAULT_IMAGE_SETTINGS.quality,
    },
    {
      label: "Background",
      value: imageSettings.background,
      highlighted: imageSettings.background !== DEFAULT_IMAGE_SETTINGS.background,
    },
    {
      label: "Format",
      value: imageSettings.format || "Not set",
      muted: !imageSettings.format,
      highlighted: Boolean(imageSettings.format),
    },
    {
      label: "Compression",
      value:
        imageSettings.compression !== null
          ? String(imageSettings.compression)
          : "Not set",
      muted: imageSettings.compression === null,
      highlighted: imageSettings.compression !== null,
    },
    {
      label: "Input fidelity",
      value: imageSettings.inputFidelity || "Not set",
      muted: !imageSettings.inputFidelity,
      highlighted: Boolean(imageSettings.inputFidelity),
    },
  ];
  const modelBadgeClass = [
    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium border shadow-sm transition-colors group",
    showModelDetails
      ? "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/70 dark:text-purple-100 dark:border-purple-700/70"
      : "bg-purple-50/60 text-purple-700 border-purple-200/70 hover:bg-purple-100 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-800/60 dark:hover:bg-purple-900/60",
  ].join(" ");
  const speedBadgeClass = showSpeedDetails
    ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/60 dark:text-amber-100 dark:border-amber-700/70 group"
    : "bg-amber-50/80 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800/50 dark:hover:bg-amber-900/50 group";
  const reasoningBadgeClass = showReasoningDetails
    ? "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/60 dark:text-indigo-100 dark:border-indigo-700/70 group"
    : "bg-indigo-50/80 text-indigo-700 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-200 dark:border-indigo-800/50 dark:hover:bg-indigo-900/50 group";
  const speedDetailsRows: DetailRow[] = [
    { label: "Tier", value: serviceTierLabel, muted: serviceTierValue === "auto" },
  ];
  const reasoningDetailsRows: DetailRow[] = [
    { label: "Effort", value: reasoningLabelValue, muted: reasoningValue === "auto" },
  ];
  const ContextToggleIcon = showContext ? ChevronUp : ChevronDown;
  const contextButtonClass = [
    "inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-md border whitespace-nowrap transition-colors group",
    showContext
      ? "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/60 dark:text-teal-100 dark:border-teal-700/60"
      : "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-200 dark:border-teal-800/60 dark:hover:bg-teal-900/50",
  ].join(" ");

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
  }, [openPanel]);

  return (
    <div className="space-y-2 w-full min-w-0 max-w-full" ref={containerRef}>
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-400">
        {modelValue !== "Unknown" && (
          <button
            type="button"
            onClick={() => togglePanel("model")}
            aria-expanded={showModelDetails}
            aria-controls={modelDetailsId}
            aria-pressed={showModelDetails}
            className={modelBadgeClass}
          >
            <span>{modelValue}</span>
            <ChevronDown
              className={`h-3 w-3 text-purple-400 dark:text-purple-300/80 ${HOVER_CHEVRON_CLASS}`}
              aria-hidden="true"
            />
          </button>
        )}
        {speedCount &&
          speedLabel &&
          renderIconBadge({
            count: speedCount,
            Icon: Zap,
            label: `Speed: ${speedLabel}`,
            className: `${speedBadgeClass} shadow-sm`,
            iconClassName: "h-3 w-3 text-amber-500",
            showChevron: true,
            chevronClassName: `h-3 w-3 text-amber-400/90 ${HOVER_CHEVRON_CLASS}`,
            onClick: () => togglePanel("speed"),
            isExpanded: showSpeedDetails,
            controlsId: speedDetailsId,
          })}
        {reasoningCount &&
          reasoningLabel &&
          renderIconBadge({
            count: reasoningCount,
            Icon: Brain,
            label: `Reasoning: ${reasoningLabel}`,
            className: `${reasoningBadgeClass} shadow-sm`,
            iconClassName: "h-3 w-3 text-indigo-500",
            showChevron: true,
            chevronClassName: `h-3 w-3 text-indigo-400/90 ${HOVER_CHEVRON_CLASS}`,
            onClick: () => togglePanel("reasoning"),
            isExpanded: showReasoningDetails,
            controlsId: reasoningDetailsId,
          })}
        {hasTools && (
          <div className="flex items-center gap-1.5">
            {renderToolBadges({
              tools: toolList,
              onImageToggle: hasImageGenerationTool
                ? () => togglePanel("image")
                : undefined,
              imageExpanded: showImageSettings,
              imageControlsId: imageSettingsId,
              onToolsToggle: () => togglePanel("tools"),
              toolsExpanded: showTools,
              toolsControlsId: toolsId,
            })}
          </div>
        )}
        {hasContext && (
          <button
            type="button"
            aria-expanded={showContext}
            aria-controls={contextId}
            aria-pressed={showContext}
            onClick={() => togglePanel("context")}
            className={contextButtonClass}
          >
            <span>Context</span>
            {dependencyItems.length > 0 && (
              <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[9px] font-semibold text-teal-700 dark:bg-teal-900/60 dark:text-teal-200">
                {dependencyItems.length}
              </span>
            )}
            <ContextToggleIcon
              className={`h-3 w-3 ${HOVER_CHEVRON_CLASS}`}
              aria-hidden="true"
            />
          </button>
        )}
        {isInProgress && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200 animate-pulse">
            Processing...
          </span>
        )}
        {status === "failed" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 border border-red-200">
            Failed
          </span>
        )}
      </div>
      {showModelDetails && (
        <div
          id={modelDetailsId}
          className="rounded-lg border border-purple-200/70 bg-purple-50/40 px-3 py-2 text-xs text-foreground/90 shadow-sm ring-1 ring-purple-100/60 dark:border-purple-800/50 dark:bg-purple-950/30 dark:ring-purple-900/40 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-200">
              Model details
            </div>
            {renderEditButton("model")}
          </div>
          {editPanel === "model" ? (
            <div className="space-y-2">
              <Select
                value={draftModel}
                onChange={(event) =>
                  setDraftModel(event.target.value as AIModel)
                }
                className="h-9"
                aria-label="Select model"
              >
                {AI_MODELS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </Select>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={isUpdating}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={!isModelDirty || isUpdating}
                  isLoading={isUpdating}
                >
                  Update
                </Button>
              </div>
            </div>
          ) : (
            <DetailRows rows={modelDetailsRows} />
          )}
        </div>
      )}
      {showSpeedDetails && (
        <div
          id={speedDetailsId}
          className="rounded-lg border border-amber-200/70 bg-amber-50/40 px-3 py-2 text-xs text-foreground/90 shadow-sm ring-1 ring-amber-100/60 dark:border-amber-800/50 dark:bg-amber-950/25 dark:ring-amber-900/40 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
              Service tier details
            </div>
            {renderEditButton("speed")}
          </div>
          {editPanel === "speed" ? (
            <div className="space-y-2">
              <Select
                value={draftServiceTier}
                onChange={(event) =>
                  setDraftServiceTier(event.target.value as ServiceTier)
                }
                className="h-9"
                aria-label="Select service tier"
              >
                <option value="auto">Auto</option>
                {Object.entries(SERVICE_TIER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={isUpdating}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={!isServiceTierDirty || isUpdating}
                  isLoading={isUpdating}
                >
                  Update
                </Button>
              </div>
            </div>
          ) : (
            <DetailRows rows={speedDetailsRows} />
          )}
        </div>
      )}
      {showReasoningDetails && (
        <div
          id={reasoningDetailsId}
          className="rounded-lg border border-indigo-200/70 bg-indigo-50/40 px-3 py-2 text-xs text-foreground/90 shadow-sm ring-1 ring-indigo-100/60 dark:border-indigo-800/50 dark:bg-indigo-950/30 dark:ring-indigo-900/40 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-200">
              Reasoning details
            </div>
            {renderEditButton("reasoning")}
          </div>
          {editPanel === "reasoning" ? (
            <div className="space-y-2">
              <Select
                value={draftReasoningEffort}
                onChange={(event) =>
                  setDraftReasoningEffort(
                    event.target.value as ReasoningEffortOption,
                  )
                }
                className="h-9"
                aria-label="Select reasoning effort"
              >
                <option value="auto">Auto</option>
                {Object.entries(REASONING_EFFORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={isUpdating}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={!isReasoningDirty || isUpdating}
                  isLoading={isUpdating}
                >
                  Update
                </Button>
              </div>
            </div>
          ) : (
            <DetailRows rows={reasoningDetailsRows} />
          )}
        </div>
      )}
      {hasTools && showTools && (
        <div
          id={toolsId}
          className="rounded-lg border border-slate-200/70 bg-slate-50/40 px-3 py-2 text-xs text-foreground/90 shadow-sm ring-1 ring-slate-100/60 dark:border-slate-800/50 dark:bg-slate-950/25 dark:ring-slate-900/40 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
              Tools
            </div>
          </div>
          <div className="space-y-3">
            {toolDetails.map((tool) => (
              <div
                key={tool.id}
                className="rounded-lg border border-border/60 bg-background/70 px-3 py-2 space-y-2"
              >
                <div className="text-xs font-semibold text-foreground">
                  {tool.name}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Configuration
                </div>
                <div className="rounded-md border border-border/60 bg-background/70 px-2 py-1 text-[11px] font-mono whitespace-pre-wrap break-words">
                  {tool.config ? (
                    JSON.stringify(tool.config, null, 2)
                  ) : (
                    <span className="text-muted-foreground">
                      No configuration
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {hasImageGenerationTool && showImageSettings && (
        <div
          id={imageSettingsId}
          className="rounded-lg border border-indigo-200/70 bg-indigo-50/40 px-3 py-2 text-xs text-foreground/90 shadow-sm ring-1 ring-indigo-100/60 dark:border-indigo-800/50 dark:bg-indigo-950/30 dark:ring-indigo-900/40 space-y-3"
        >
          <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-200">
              Image generation settings
            </div>
          </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-full border border-indigo-200/70 bg-indigo-100/70 px-2 py-0.5 font-medium text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-900/40 dark:text-indigo-200">
                Source: {imageSettingsSource}
              </span>
              {toolChoice && toolChoice !== "auto" && (
                <span className="rounded-full border border-indigo-200/70 bg-indigo-100/70 px-2 py-0.5 font-medium text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-900/40 dark:text-indigo-200">
                  Tool choice: {toolChoice}
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {imageSettingsRows.map((row) => (
              <div
                key={row.label}
                className={`flex items-center justify-between rounded-md border px-2 py-1 ${
                  row.highlighted && !row.muted
                    ? "border-indigo-200/70 bg-indigo-100/60 dark:border-indigo-800/60 dark:bg-indigo-900/40"
                    : "border-border/60 bg-background/70"
                }`}
              >
                <span className="text-[11px] font-medium text-muted-foreground">
                  {row.label}
                </span>
                <span
                  className={`text-[11px] font-semibold ${
                    row.muted
                      ? "text-muted-foreground"
                      : row.highlighted
                        ? "text-indigo-700 dark:text-indigo-200"
                        : "text-foreground"
                  }`}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {hasContext && showContext && (
        <div
          id={contextId}
          className="w-full max-w-full overflow-hidden rounded-lg border border-teal-200/70 bg-teal-50/40 px-3 py-2 text-xs text-foreground/90 shadow-sm ring-1 ring-teal-100/60 dark:border-teal-800/50 dark:bg-teal-950/25 dark:ring-teal-900/40 space-y-3"
        >
          {hasDependencies && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Input
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Steps
                </div>
                <div className="grid grid-flow-col auto-cols-[12rem] sm:auto-cols-[16rem] grid-rows-1 gap-2 sm:gap-3 overflow-x-auto pb-2 px-2 sm:-mx-1 sm:px-1 snap-x snap-mandatory scrollbar-hide">
                  {dependencyPreviews.map(({ dependency, step: dependencyStep }) => (
                    <div
                      key={`dependency-context-${dependencyStep.step_order ?? dependency.index}`}
                      title={dependency.label}
                      className="group flex w-56 sm:w-64 flex-shrink-0 snap-start flex-col text-left"
                    >
                      <div className="flex w-full flex-col overflow-hidden rounded-xl border border-border bg-muted/40 shadow-sm transition group-hover:shadow-md">
                        <div className="aspect-[3/4] w-full overflow-hidden">
                          <div className="h-full w-full overflow-y-auto scrollbar-hide-until-hover p-4 text-[11px] text-foreground/90">
                            {renderDependencyOutputPreview(dependencyStep.output)}
                          </div>
                        </div>
                        <div className="border-t border-border/60 bg-background/80 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground line-clamp-1">
                              {dependency.label}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Instructions
            </div>
            <div className="rounded-md border border-border/60 bg-background/70 px-2 py-1 text-[11px] whitespace-pre-wrap text-foreground/90">
              {instructions || "No instructions available"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
