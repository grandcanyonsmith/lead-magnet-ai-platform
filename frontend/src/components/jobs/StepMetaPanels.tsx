"use client";

import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AI_MODELS } from "@/constants/models";
import { REASONING_EFFORT_LABELS, SERVICE_TIER_LABELS } from "@/utils/stepMeta";
import type { AIModel, ImageGenerationSettings, ServiceTier } from "@/types/workflow";
import type {
  DependencyPreview,
  DetailRow,
  EditablePanel,
  ImageSettingRow,
  ModelRestriction,
  ReasoningEffortOption,
  ToolDetail,
} from "@/components/jobs/StepMetaTypes";

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

type ModelDetailsPanelProps = {
  id: string;
  editPanel: EditablePanel | null;
  draftModel: AIModel;
  onDraftModelChange: (model: AIModel) => void;
  modelRestriction: ModelRestriction;
  renderEditButton: (panel: EditablePanel) => JSX.Element | null;
  onCancel: () => void;
  onSave: () => void;
  isUpdating: boolean;
  isModelDirty: boolean;
  isModelAllowed: boolean;
  modelDetailsRows: DetailRow[];
};

export function ModelDetailsPanel({
  id,
  editPanel,
  draftModel,
  onDraftModelChange,
  modelRestriction,
  renderEditButton,
  onCancel,
  onSave,
  isUpdating,
  isModelDirty,
  isModelAllowed,
  modelDetailsRows,
}: ModelDetailsPanelProps) {
  return (
    <div
      id={id}
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
            onChange={(nextValue) =>
              onDraftModelChange(nextValue as AIModel)
            }
            className="h-9"
            aria-label="Select model"
          >
            {AI_MODELS.map((model) => {
              const isAllowed =
                !modelRestriction.allowedModels ||
                modelRestriction.allowedModels.has(model.value);
              return (
                <option
                  key={model.value}
                  value={model.value}
                  disabled={!isAllowed}
                >
                  {model.label}
                </option>
              );
            })}
          </Select>
          {modelRestriction.reason && (
            <div className="rounded-md border border-border/60 bg-background/70 px-2 py-1 text-[11px] text-muted-foreground">
              {modelRestriction.reason}
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              disabled={!isModelDirty || !isModelAllowed || isUpdating}
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
  );
}

type SpeedDetailsPanelProps = {
  id: string;
  editPanel: EditablePanel | null;
  draftServiceTier: ServiceTier;
  onDraftServiceTierChange: (value: ServiceTier) => void;
  renderEditButton: (panel: EditablePanel) => JSX.Element | null;
  onCancel: () => void;
  onSave: () => void;
  isUpdating: boolean;
  isServiceTierDirty: boolean;
  speedDetailsRows: DetailRow[];
};

export function SpeedDetailsPanel({
  id,
  editPanel,
  draftServiceTier,
  onDraftServiceTierChange,
  renderEditButton,
  onCancel,
  onSave,
  isUpdating,
  isServiceTierDirty,
  speedDetailsRows,
}: SpeedDetailsPanelProps) {
  return (
    <div
      id={id}
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
            onChange={(nextValue) =>
              onDraftServiceTierChange(nextValue as ServiceTier)
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
              onClick={onCancel}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSave}
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
  );
}

type ReasoningDetailsPanelProps = {
  id: string;
  editPanel: EditablePanel | null;
  draftReasoningEffort: ReasoningEffortOption;
  onDraftReasoningEffortChange: (value: ReasoningEffortOption) => void;
  renderEditButton: (panel: EditablePanel) => JSX.Element | null;
  onCancel: () => void;
  onSave: () => void;
  isUpdating: boolean;
  isReasoningDirty: boolean;
  reasoningDetailsRows: DetailRow[];
};

export function ReasoningDetailsPanel({
  id,
  editPanel,
  draftReasoningEffort,
  onDraftReasoningEffortChange,
  renderEditButton,
  onCancel,
  onSave,
  isUpdating,
  isReasoningDirty,
  reasoningDetailsRows,
}: ReasoningDetailsPanelProps) {
  return (
    <div
      id={id}
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
            onChange={(nextValue) =>
              onDraftReasoningEffortChange(
                nextValue as ReasoningEffortOption,
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
              onClick={onCancel}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSave}
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
  );
}

type ToolsPanelProps = {
  id: string;
  toolDetails: ToolDetail[];
};

export function ToolsPanel({ id, toolDetails }: ToolsPanelProps) {
  return (
    <div
      id={id}
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
                <span className="text-muted-foreground">No configuration</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type ImageSettingsPanelProps = {
  id: string;
  imageSettingsSource: string;
  toolChoice: string | null;
  imageSettingsRows: ImageSettingRow[];
  editPanel: EditablePanel | null;
  draftImageSettings: ImageGenerationSettings;
  onDraftImageSettingsChange: (
    field: keyof ImageGenerationSettings,
    value: ImageGenerationSettings[keyof ImageGenerationSettings],
  ) => void;
  renderEditButton: (panel: EditablePanel) => JSX.Element | null;
  onCancel: () => void;
  onSave: () => void;
  isUpdating: boolean;
  isImageSettingsDirty: boolean;
};

export function ImageSettingsPanel({
  id,
  imageSettingsSource,
  toolChoice,
  imageSettingsRows,
  editPanel,
  draftImageSettings,
  onDraftImageSettingsChange,
  renderEditButton,
  onCancel,
  onSave,
  isUpdating,
  isImageSettingsDirty,
}: ImageSettingsPanelProps) {
  const showCompression =
    draftImageSettings.format === "jpeg" || draftImageSettings.format === "webp";

  return (
    <div
      id={id}
      className="rounded-lg border border-indigo-200/70 bg-indigo-50/40 px-3 py-2 text-xs text-foreground/90 shadow-sm ring-1 ring-indigo-100/60 dark:border-indigo-800/50 dark:bg-indigo-950/30 dark:ring-indigo-900/40 space-y-3"
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-200">
            Image generation settings
          </div>
          {renderEditButton("image")}
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
      {editPanel === "image" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Model
              </label>
              <Select
                value={draftImageSettings.model || "gpt-image-1.5"}
                onChange={(nextValue) =>
                  onDraftImageSettingsChange("model", nextValue)
                }
                className="h-9"
                aria-label="Select image model"
              >
                <option value="gpt-image-1.5">gpt-image-1.5</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Size
              </label>
              <Select
                value={draftImageSettings.size || "auto"}
                onChange={(nextValue) =>
                  onDraftImageSettingsChange(
                    "size",
                    nextValue as ImageGenerationSettings["size"],
                  )
                }
                className="h-9"
                aria-label="Select image size"
              >
                <option value="auto">Auto (default)</option>
                <option value="1024x1024">1024x1024 (Square)</option>
                <option value="1024x1536">1024x1536 (Portrait)</option>
                <option value="1536x1024">1536x1024 (Landscape)</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Quality
              </label>
              <Select
                value={draftImageSettings.quality || "auto"}
                onChange={(nextValue) =>
                  onDraftImageSettingsChange(
                    "quality",
                    nextValue as ImageGenerationSettings["quality"],
                  )
                }
                className="h-9"
                aria-label="Select image quality"
              >
                <option value="auto">Auto (default)</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Format
              </label>
              <Select
                value={draftImageSettings.format || ""}
                onChange={(nextValue) =>
                  onDraftImageSettingsChange(
                    "format",
                    (nextValue || undefined) as ImageGenerationSettings["format"],
                  )
                }
                className="h-9"
                aria-label="Select image format"
              >
                <option value="">Default (PNG)</option>
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
                <option value="webp">WebP</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Background
              </label>
              <Select
                value={draftImageSettings.background || "auto"}
                onChange={(nextValue) =>
                  onDraftImageSettingsChange(
                    "background",
                    nextValue as ImageGenerationSettings["background"],
                  )
                }
                className="h-9"
                aria-label="Select background mode"
              >
                <option value="auto">Auto (default)</option>
                <option value="transparent">Transparent</option>
                <option value="opaque">Opaque</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Input fidelity
              </label>
              <Select
                value={draftImageSettings.input_fidelity || ""}
                onChange={(nextValue) =>
                  onDraftImageSettingsChange(
                    "input_fidelity",
                    (nextValue || undefined) as ImageGenerationSettings["input_fidelity"],
                  )
                }
                className="h-9"
                aria-label="Select input fidelity"
              >
                <option value="">Default</option>
                <option value="low">Low</option>
                <option value="high">High</option>
              </Select>
            </div>

            {showCompression && (
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Compression
                </label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={
                    draftImageSettings.compression !== undefined
                      ? String(draftImageSettings.compression)
                      : ""
                  }
                  onChange={(event) => {
                    const value = event.target.value;
                    onDraftImageSettingsChange(
                      "compression",
                      value === "" ? undefined : Number(value),
                    );
                  }}
                  placeholder="0-100"
                  className="h-9"
                  aria-label="Set compression"
                />
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              disabled={!isImageSettingsDirty || isUpdating}
              isLoading={isUpdating}
            >
              Update
            </Button>
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}

type ContextPanelProps = {
  id: string;
  dependencyPreviews: DependencyPreview[];
  instructions?: string;
};

export function ContextPanel({ id, dependencyPreviews, instructions }: ContextPanelProps) {
  const hasDependencies = dependencyPreviews.length > 0;

  return (
    <div
      id={id}
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
            <div className="grid grid-flow-col auto-cols-[85vw] sm:auto-cols-[16rem] grid-rows-1 gap-2 sm:gap-3 overflow-x-auto pb-2 px-2 sm:-mx-1 sm:px-1 snap-x snap-mandatory scrollbar-hide">
              {dependencyPreviews.map(({ dependency, step: dependencyStep }) => (
                <div
                  key={`dependency-context-${dependencyStep.step_order ?? dependency.index}`}
                  title={dependency.label}
                  className="group flex w-full sm:w-64 flex-col text-left snap-start"
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
  );
}
