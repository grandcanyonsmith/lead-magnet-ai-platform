"use client";

import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useAIModelOptions } from "@/hooks/useAIModelOptions";
import type { AIModel } from "@/types/workflow";
import type {
  DetailRow,
  EditablePanel,
  ModelRestriction,
} from "@/components/jobs/StepMetaTypes";
import { DetailRows } from "./utils";
import { CollapsiblePanel } from "@/components/ui/panels/CollapsiblePanel";

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
  onToggle?: () => void;
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
  onToggle,
}: ModelDetailsPanelProps) {
  const {
    options: modelOptions,
    loading: aiModelsLoading,
    error: aiModelsError,
  } = useAIModelOptions({ currentModel: draftModel });

  return (
    <CollapsiblePanel
      title={<span className="text-[11px] font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-200">Model details</span>}
      expanded={true}
      onToggle={() => onToggle && onToggle()}
      actions={renderEditButton("model")}
      className="border-purple-200/70 bg-purple-50/40 ring-1 ring-purple-100/60 dark:border-purple-800/50 dark:bg-purple-950/30 dark:ring-purple-900/40"
      headerClassName="bg-transparent border-b-0 py-2 px-3"
      contentClassName="pt-0 px-3 pb-2"
    >
      <div id={id} className="space-y-3">
        {editPanel === "model" ? (
          <div className="space-y-2">
            <Select
              value={draftModel}
              onChange={(nextValue) =>
                onDraftModelChange(nextValue as AIModel)
              }
              className="h-9"
              aria-label="Select model"
              disabled={aiModelsLoading}
              searchable={true}
              searchPlaceholder="Search models..."
            >
              {aiModelsLoading && <option value="">Loading models...</option>}
              {modelOptions.map((model) => {
                const isAllowed =
                  !modelRestriction.allowedModels ||
                  modelRestriction.allowedModels.has(model.value as AIModel);
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
            {aiModelsError && !aiModelsLoading && (
              <div className="rounded-md border border-border/60 bg-background/70 px-2 py-1 text-[11px] text-muted-foreground">
                Unable to load models. Showing current selection.
              </div>
            )}
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
    </CollapsiblePanel>
  );
}
