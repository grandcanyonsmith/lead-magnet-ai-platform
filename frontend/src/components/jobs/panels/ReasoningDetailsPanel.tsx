"use client";

import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { REASONING_EFFORT_LABELS } from "@/utils/stepMeta";
import type {
  DetailRow,
  EditablePanel,
  ReasoningEffortOption,
} from "@/components/jobs/StepMetaTypes";
import { DetailRows } from "./utils";

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
