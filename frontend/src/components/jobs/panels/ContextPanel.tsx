"use client";

import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import type {
  DependencyPreview,
  EditablePanel,
} from "@/components/jobs/StepMetaTypes";
import { renderDependencyOutputPreview } from "./utils";

type ContextPanelProps = {
  id: string;
  dependencyPreviews: DependencyPreview[];
  instructions?: string;
  editPanel?: EditablePanel | null;
  draftInstructions?: string;
  onDraftInstructionsChange?: (value: string) => void;
  renderEditButton?: (panel: EditablePanel) => JSX.Element | null;
  onCancel?: () => void;
  onSave?: () => void;
  isUpdating?: boolean;
  isInstructionsDirty?: boolean;
};

export function ContextPanel({
  id,
  dependencyPreviews,
  instructions,
  editPanel,
  draftInstructions,
  onDraftInstructionsChange,
  renderEditButton,
  onCancel,
  onSave,
  isUpdating,
  isInstructionsDirty,
}: ContextPanelProps) {
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
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Instructions
          </div>
          {renderEditButton && renderEditButton("context")}
        </div>
        {editPanel === "context" && onDraftInstructionsChange ? (
          <div className="space-y-2">
            <Textarea
              value={draftInstructions}
              onChange={(e) => onDraftInstructionsChange(e.target.value)}
              className="min-h-[100px] text-xs font-mono"
              placeholder="Enter instructions..."
            />
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
                disabled={!isInstructionsDirty || isUpdating}
                isLoading={isUpdating}
              >
                Update
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-border/60 bg-background/70 px-2 py-1 text-[11px] whitespace-pre-wrap text-foreground/90">
            {instructions || "No instructions available"}
          </div>
        )}
      </div>
    </div>
  );
}
