"use client";

import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { ImageGenerationSettings } from "@/types/workflow";
import type {
  EditablePanel,
  ImageSettingRow,
} from "@/components/jobs/StepMetaTypes";

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
                searchable={true}
                searchPlaceholder="Search models..."
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
