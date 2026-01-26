import { useMemo, useState } from "react";
import { DEFAULT_AI_MODEL } from "@/constants/models";
import { MergedStep, StepStatus } from "@/types/job";
import type {
  AIModel,
  ImageGenerationSettings,
  ReasoningEffort,
  ServiceTier,
  Tool as WorkflowTool,
} from "@/types/workflow";
import { useSettings } from "@/hooks/api/useSettings";
import type {
  DependencyItem,
  DependencyPreview,
  DetailRow,
  EditablePanel,
  ImageSettingRow,
  ModelRestriction,
  ReasoningEffortOption,
  ToolDetail,
} from "@/components/jobs/StepMetaTypes";
import {
  extractReasoningEffort,
  extractServiceTier,
  getToolName,
  REASONING_EFFORT_LABELS,
  REASONING_EFFORT_LEVELS,
  SERVICE_TIER_LABELS,
  SERVICE_TIER_SPEED,
  getRecord,
  getString,
  getNumber,
} from "@/utils/stepMeta";
import {
  resolveImageSettingsDefaults,
  type ResolvedImageSettings,
} from "@/utils/imageSettings";
import { getStepInput } from "@/utils/stepInput";
import { getToolDisplayLabel } from "@/components/jobs/panels/utils";

type StepMetaUpdate = {
  model?: AIModel | null;
  service_tier?: ServiceTier | null;
  reasoning_effort?: ReasoningEffort | null;
  image_generation?: ImageGenerationSettings;
  tools?: WorkflowTool[] | null;
  instructions?: string | null;
};

const EMPTY_TOOL_LIST: WorkflowTool[] = [];

const SHELL_COMPATIBLE_MODELS: AIModel[] = [
  "gpt-5.2",
  "gpt-5.1",
  "gpt-5.1-codex",
  "gpt-5",
  "gpt-4o",
  "gpt-4-turbo",
];
const COMPUTER_USE_MODEL: AIModel = "computer-use-preview";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  getRecord(value) !== null;

const isImageSettingsDifferent = (
  current: ResolvedImageSettings,
  defaults: ResolvedImageSettings,
): boolean => {
  if (current.model !== defaults.model) return true;
  if (current.size !== defaults.size) return true;
  if (current.quality !== defaults.quality) return true;
  if (current.background !== defaults.background) return true;
  const format = current.format || null;
  const defaultFormat = defaults.format || null;
  if (format !== defaultFormat) return true;
  const compression =
    typeof current.compression === "number" ? current.compression : null;
  const defaultCompression =
    typeof defaults.compression === "number" ? defaults.compression : null;
  if (compression !== defaultCompression) return true;
  const fidelity = current.input_fidelity || null;
  const defaultFidelity = defaults.input_fidelity || null;
  if (fidelity !== defaultFidelity) return true;
  return false;
};

type UseStepMetaRowProps = {
  step: MergedStep;
  status: StepStatus;
  allSteps?: MergedStep[];
  canEdit?: boolean;
  onEditStep?: (stepIndex: number) => void;
  onQuickUpdateStep?: (stepIndex: number, update: StepMetaUpdate) => Promise<void>;
  updatingStepIndex?: number | null;
};

export type MetaPanel = "context" | "image" | "model" | "speed" | "reasoning" | "tools";

export function useStepMetaRow({
  step,
  status,
  allSteps,
  canEdit = false,
  onEditStep,
  onQuickUpdateStep,
  updatingStepIndex,
}: UseStepMetaRowProps) {
  const isInProgress = status === "in_progress";
  const { settings } = useSettings();
  const defaultImageSettings = useMemo(
    () => resolveImageSettingsDefaults(settings?.default_image_settings),
    [settings?.default_image_settings],
  );
  const [openPanel, setOpenPanel] = useState<MetaPanel | null>(null);
  const [editPanel, setEditPanel] = useState<EditablePanel | null>(null);
  const [draftModel, setDraftModel] = useState<AIModel>(DEFAULT_AI_MODEL);
  const [draftServiceTier, setDraftServiceTier] = useState<ServiceTier>("auto");
  const [draftReasoningEffort, setDraftReasoningEffort] =
    useState<ReasoningEffortOption>("auto");
  const [draftImageSettings, setDraftImageSettings] =
    useState<ImageGenerationSettings>(() => ({ ...defaultImageSettings }));
  const [draftInstructions, setDraftInstructions] = useState<string>("");
  const [draftTools, setDraftTools] = useState<WorkflowTool[]>([]);
  
  const showContext = openPanel === "context";
  const showImageSettings = openPanel === "image";
  const showModelDetails = openPanel === "model";
  const showSpeedDetails = openPanel === "speed";
  const showReasoningDetails = openPanel === "reasoning";
  const showTools = openPanel === "tools";
  
  const togglePanel = (panel: MetaPanel) =>
    setOpenPanel((prev) => (prev === panel ? null : panel));
    
  const instructions = step.instructions?.trim();
  const stepOrderId = step.step_order ?? "unknown";
  const contextId = `step-context-${stepOrderId}`;
  const toolsId = `step-tools-${stepOrderId}`;
  const imageSettingsId = `step-image-settings-${stepOrderId}`;
  const modelDetailsId = `step-model-details-${stepOrderId}`;
  const speedDetailsId = `step-speed-details-${stepOrderId}`;
  const reasoningDetailsId = `step-reasoning-details-${stepOrderId}`;
  
  const stepInput = getStepInput(step.input);
  const inputRecord = stepInput ?? null;
  const tools = Array.isArray(stepInput?.tools)
    ? stepInput.tools
    : step.tools;
  const toolList = Array.isArray(tools) ? tools : EMPTY_TOOL_LIST;
  const imageTool = toolList.find(
    (tool) => getToolName(tool) === "image_generation",
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
  const editDisabled = !canEditStep;
  const stepIndex =
    step.step_order !== undefined ? step.step_order - 1 : null;
  const isUpdating = stepIndex !== null && updatingStepIndex === stepIndex;
  const toolChoice =
    getString(stepInput?.tool_choice) || getString(step.tool_choice);
  const modelFromStep = getString(step.model);
  const modelFromInput = getString(inputRecord?.model);
  const usageModel = getString(step.usage_info?.model);
  const modelValue =
    modelFromStep || modelFromInput || usageModel || "Unknown";
  const modelDetailsRows: DetailRow[] = [
    { label: "Model", value: modelValue, muted: modelValue === "Unknown" },
  ];
  if (usageModel && usageModel !== modelValue) {
    modelDetailsRows.push({ label: "Usage model", value: usageModel });
  }
  const dependencyItems: DependencyItem[] =
    step.depends_on?.map((dep, idx) => ({
      index: dep,
      label: step.dependency_labels?.[idx] || `Step ${dep + 1}`,
    })) || [];
  const dependencyPreviews: DependencyPreview[] = dependencyItems
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
  
  const toolDetails = useMemo<ToolDetail[]>(
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
          const record = tool as unknown as Record<string, unknown>;
          const { type: _type, name: _name, ...rest } = record;
          const config = Object.keys(rest).length > 0 ? rest : null;
          const displayName = getToolDisplayLabel(tool);
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
  
  const toolTypes = useMemo(
    () =>
      new Set(toolList.map((tool) => getToolName(tool)).filter(Boolean)),
    [toolList],
  );
  const hasComputerUseTool = toolTypes.has("computer_use_preview");
  const hasShellTool = toolTypes.has("shell");
  const modelRestriction = useMemo<ModelRestriction>(() => {
    if (hasComputerUseTool) {
      return {
        allowedModels: new Set<AIModel>([COMPUTER_USE_MODEL]),
        reason: "Computer use steps require the computer-use-preview model.",
      };
    }
    if (hasShellTool) {
      return {
        allowedModels: new Set<AIModel>(SHELL_COMPATIBLE_MODELS),
        reason: "Shell tool steps only support GPT-5 models.",
      };
    }
    return { allowedModels: null, reason: null };
  }, [hasComputerUseTool, hasShellTool]);
  
  const serviceTier = extractServiceTier(step);
  const normalizedServiceTier = serviceTier?.toLowerCase();
  const speedCount =
    normalizedServiceTier && normalizedServiceTier !== "auto"
      ? SERVICE_TIER_SPEED[normalizedServiceTier]
      : undefined;
  const speedLabel = normalizedServiceTier
    ? SERVICE_TIER_LABELS[normalizedServiceTier]
    : undefined;
  const stepServiceTier = getString(
    (step as { service_tier?: unknown }).service_tier,
  );
  const inputServiceTier = getString(inputRecord?.service_tier);
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
  const stepReasoningEffort = getString(
    (step as { reasoning_effort?: unknown }).reasoning_effort,
  );
  const inputReasoningEffort = getString(inputRecord?.reasoning_effort);
  const inputReasoningNested = isRecord(inputRecord?.reasoning)
    ? getString((inputRecord.reasoning as Record<string, unknown>).effort)
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
  const isModelAllowed =
    !modelRestriction.allowedModels ||
    modelRestriction.allowedModels.has(draftModel);
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
    if (panel === "image") {
      setDraftImageSettings(imageSettings);
    }
    if (panel === "context") {
      setDraftInstructions(instructions || "");
    }
    if (panel === "tools") {
      setDraftTools(toolList);
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
    if (editPanel === "image") {
      update.image_generation = {
        model: draftImageSettings.model || defaultImageSettings.model,
        size: draftImageSettings.size || defaultImageSettings.size,
        quality: draftImageSettings.quality || defaultImageSettings.quality,
        background:
          draftImageSettings.background || defaultImageSettings.background,
        format: draftImageSettings.format || undefined,
        compression:
          typeof draftImageSettings.compression === "number"
            ? draftImageSettings.compression
            : undefined,
        input_fidelity: draftImageSettings.input_fidelity || undefined,
      };
    }
    if (editPanel === "context") {
      update.instructions = draftInstructions;
    }
    if (editPanel === "tools") {
      update.tools = draftTools;
    }
    await onQuickUpdateStep(stepIndex, update);
    setEditPanel(null);
  };

  const handleDraftImageSettingsChange = (
    field: keyof ImageGenerationSettings,
    value: ImageGenerationSettings[keyof ImageGenerationSettings],
  ) => {
    setDraftImageSettings((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "format") {
        const format = value as ImageGenerationSettings["format"] | undefined;
        if (format !== "jpeg" && format !== "webp") {
          next.compression = undefined;
        }
      }
      if (field === "compression") {
        if (typeof value === "number" && Number.isFinite(value)) {
          next.compression = Math.min(100, Math.max(0, value));
        }
        if (value === undefined || value === null || Number.isNaN(value)) {
          next.compression = undefined;
        }
      }
      return next;
    });
  };

  const resolveImageSettings = (
    config: Record<string, unknown> | null,
  ): ResolvedImageSettings => {
    const model =
      (getString(config?.model) as ImageGenerationSettings["model"]) ||
      defaultImageSettings.model;
    const size =
      (getString(config?.size) as ImageGenerationSettings["size"]) ||
      defaultImageSettings.size;
    const quality =
      (getString(
        config?.quality,
      ) as ImageGenerationSettings["quality"]) || defaultImageSettings.quality;
    const background =
      (getString(
        config?.background,
      ) as ImageGenerationSettings["background"]) ||
      defaultImageSettings.background;
    const format =
      (getString(
        config?.format,
      ) as ImageGenerationSettings["format"]) || defaultImageSettings.format;
    const supportsCompression = format === "jpeg" || format === "webp";
    const compressionValue = getNumber(config?.compression);
    const compression = supportsCompression
      ? compressionValue ?? defaultImageSettings.compression
      : undefined;
    const inputFidelity =
      (getString(
        config?.input_fidelity,
      ) as ImageGenerationSettings["input_fidelity"]) ||
      defaultImageSettings.input_fidelity;
    return {
      model,
      size,
      quality,
      format,
      compression,
      background,
      input_fidelity: inputFidelity,
    };
  };
  
  const imageSettings = resolveImageSettings(imageToolConfig);
  const imageHasOverrides = hasImageGenerationTool
    ? isImageSettingsDifferent(imageSettings, defaultImageSettings)
    : false;
  const imageSettingsSource = imageHasOverrides ? "Custom" : "Defaults";
  const formatDefault = defaultImageSettings.format || null;
  const formatCurrent = imageSettings.format || null;
  const compressionDefault =
    typeof defaultImageSettings.compression === "number"
      ? defaultImageSettings.compression
      : null;
  const compressionCurrent =
    typeof imageSettings.compression === "number" ? imageSettings.compression : null;
  const fidelityDefault = defaultImageSettings.input_fidelity || null;
  const fidelityCurrent = imageSettings.input_fidelity || null;
  const imageSettingsRows: ImageSettingRow[] = [
    {
      label: "Model",
      value: imageSettings.model,
      highlighted: imageSettings.model !== defaultImageSettings.model,
    },
    {
      label: "Size",
      value: imageSettings.size,
      highlighted: imageSettings.size !== defaultImageSettings.size,
    },
    {
      label: "Quality",
      value: imageSettings.quality,
      highlighted: imageSettings.quality !== defaultImageSettings.quality,
    },
    {
      label: "Background",
      value: imageSettings.background,
      highlighted: imageSettings.background !== defaultImageSettings.background,
    },
    {
      label: "Format",
      value: imageSettings.format || "Not set",
      muted: !formatCurrent,
      highlighted: formatCurrent !== formatDefault,
    },
    {
      label: "Compression",
      value:
        typeof imageSettings.compression === "number"
          ? String(imageSettings.compression)
          : "Not set",
      muted: typeof imageSettings.compression !== "number",
      highlighted: compressionCurrent !== compressionDefault,
    },
    {
      label: "Input fidelity",
      value: imageSettings.input_fidelity || "Not set",
      muted: !fidelityCurrent,
      highlighted: fidelityCurrent !== fidelityDefault,
    },
  ];
  const normalizeImageSettings = (settings: ImageGenerationSettings) => ({
    model: settings.model || defaultImageSettings.model,
    size: settings.size || defaultImageSettings.size,
    quality: settings.quality || defaultImageSettings.quality,
    background: settings.background || defaultImageSettings.background,
    format: settings.format ?? formatDefault,
    compression:
      typeof settings.compression === "number"
        ? settings.compression
        : compressionDefault,
    input_fidelity: settings.input_fidelity ?? fidelityDefault,
  });
  const isImageSettingsDirty =
    JSON.stringify(normalizeImageSettings(draftImageSettings)) !==
    JSON.stringify(normalizeImageSettings(imageSettings));
  const isInstructionsDirty = draftInstructions !== (instructions || "");
  const isToolsDirty = JSON.stringify(draftTools) !== JSON.stringify(toolList);

  const modelBadgeClass = [
    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium border shadow-sm transition-colors cursor-pointer group",
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
  const contextButtonClass = [
    "inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-md border whitespace-nowrap transition-colors cursor-pointer group",
    showContext
      ? "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/60 dark:text-teal-100 dark:border-teal-700/60"
      : "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-200 dark:border-teal-800/60 dark:hover:bg-teal-900/50",
  ].join(" ");

  return {
    openPanel,
    setOpenPanel,
    editPanel,
    setEditPanel,
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
  };
}
