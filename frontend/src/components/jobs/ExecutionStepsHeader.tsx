"use client";

import { Button } from "@/components/ui/Button";

interface ExecutionStepsHeaderProps {
  variant: "compact" | "expanded";
  onVariantChange?: (variant: "compact" | "expanded") => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  hasTimelineSteps: boolean;
  timelineStepOrdersLength: number;
  expandedStepsSize: number;
}

export function ExecutionStepsHeader({
  variant,
  onVariantChange,
  onExpandAll,
  onCollapseAll,
  hasTimelineSteps,
  timelineStepOrdersLength,
  expandedStepsSize,
}: ExecutionStepsHeaderProps) {
  if (
    (!onVariantChange &&
      (variant !== "expanded" || (!onExpandAll && !onCollapseAll))) ||
    !hasTimelineSteps
  ) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onVariantChange && (
        <div className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-muted/40 p-1 text-xs">
          <button
            type="button"
            onClick={() => onVariantChange("compact")}
            className={`rounded-md px-3 py-1 font-semibold transition-colors ${
              variant === "compact"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={variant === "compact"}
          >
            Compact
          </button>
          <button
            type="button"
            onClick={() => onVariantChange("expanded")}
            className={`rounded-md px-3 py-1 font-semibold transition-colors ${
              variant === "expanded"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={variant === "expanded"}
          >
            Expanded
          </button>
        </div>
      )}
      {variant === "expanded" && (
        <>
          {onExpandAll && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onExpandAll}
              disabled={timelineStepOrdersLength === 0}
            >
              Expand all
            </Button>
          )}
          {onCollapseAll && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCollapseAll}
              disabled={expandedStepsSize === 0}
            >
              Collapse all
            </Button>
          )}
        </>
      )}
    </div>
  );
}
