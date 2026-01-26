"use client";

import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { SERVICE_TIER_LABELS } from "@/utils/stepMeta";
import type { ServiceTier } from "@/types/workflow";
import type {
  DetailRow,
  EditablePanel,
} from "@/components/jobs/StepMetaTypes";
import { DetailRows } from "./utils";

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
