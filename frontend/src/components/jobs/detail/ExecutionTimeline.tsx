"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  FiCheckCircle,
  FiXCircle,
  FiLoader,
  FiClock,
} from "react-icons/fi";
import type { MergedStep, StepStatus } from "@/types/job";
import { getStepStatus } from "@/components/jobs/utils";
import { formatDurationMs } from "@/utils/jobFormatting";

interface ExecutionTimelineProps {
  steps: MergedStep[];
  selectedStepOrder: number | null;
  onSelectStep: (stepOrder: number) => void;
  jobStatus?: string;
}

const STATUS_ICON: Record<StepStatus, React.ReactNode> = {
  completed: <FiCheckCircle className="h-4 w-4 text-green-500" />,
  failed: <FiXCircle className="h-4 w-4 text-red-500" />,
  in_progress: <FiLoader className="h-4 w-4 text-blue-500 animate-spin" />,
  pending: <FiClock className="h-4 w-4 text-muted-foreground/50" />,
};

const STATUS_LINE_COLOR: Record<StepStatus, string> = {
  completed: "bg-green-400 dark:bg-green-600",
  failed: "bg-red-400 dark:bg-red-600",
  in_progress: "bg-blue-400 dark:bg-blue-500",
  pending: "bg-border",
};

export function ExecutionTimeline({
  steps,
  selectedStepOrder,
  onSelectStep,
  jobStatus,
}: ExecutionTimelineProps) {
  const sortedSteps = useMemo(() => {
    if (!steps || steps.length === 0) return [];
    return [...steps].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0));
  }, [steps]);

  const visibleSteps = useMemo(
    () => sortedSteps.filter((step) => step.step_type !== "form_submission"),
    [sortedSteps],
  );

  const getStatus = (step: MergedStep) =>
    getStepStatus(step, sortedSteps, jobStatus);

  return (
    <nav aria-label="Execution steps" className="relative">
      <ul className="relative space-y-0">
        {visibleSteps.map((step, idx) => {
          const stepOrder = step.step_order ?? 0;
          const status = getStatus(step);
          const isSelected = selectedStepOrder === stepOrder;
          const isLast = idx === visibleSteps.length - 1;
          const durationLabel =
            step.duration_ms !== undefined
              ? formatDurationMs(step.duration_ms)
              : null;
          const costValue = step.usage_info?.cost_usd;
          const costLabel =
            costValue !== undefined
              ? `$${(typeof costValue === "number" ? costValue : parseFloat(String(costValue) || "0")).toFixed(2)}`
              : null;
          const title = step.step_name || `Step ${stepOrder}`;

          return (
            <li key={stepOrder} className="relative">
              <button
                type="button"
                onClick={() => onSelectStep(stepOrder)}
                className={`
                  w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors rounded-lg
                  ${isSelected
                    ? "bg-primary/8 dark:bg-primary/10"
                    : "hover:bg-muted/60"
                  }
                `}
              >
                {/* Icon + connector line */}
                <div className="relative flex flex-col items-center shrink-0 pt-0.5">
                  <div className="relative z-10 flex items-center justify-center w-5 h-5">
                    {STATUS_ICON[status]}
                  </div>
                  {!isLast && (
                    <div
                      className={`absolute top-6 w-0.5 ${STATUS_LINE_COLOR[status]}`}
                      style={{ height: "calc(100% + 4px)" }}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 pt-px">
                  <p
                    className={`text-[13px] leading-tight truncate ${
                      isSelected
                        ? "font-semibold text-foreground"
                        : "font-medium text-foreground/80"
                    }`}
                  >
                    {title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                    {durationLabel && <span>{durationLabel}</span>}
                    {durationLabel && costLabel && (
                      <span className="text-muted-foreground/40">&middot;</span>
                    )}
                    {costLabel && (
                      <span className="tabular-nums">{costLabel}</span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function ExecutionTimelineMobile({
  steps,
  selectedStepOrder,
  onSelectStep,
  jobStatus,
}: ExecutionTimelineProps) {
  const buttonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const sortedSteps = useMemo(() => {
    if (!steps || steps.length === 0) return [];
    return [...steps].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0));
  }, [steps]);

  const visibleSteps = useMemo(
    () => sortedSteps.filter((step) => step.step_type !== "form_submission"),
    [sortedSteps],
  );

  const getStatus = (step: MergedStep) =>
    getStepStatus(step, sortedSteps, jobStatus);

  useEffect(() => {
    if (selectedStepOrder === null || selectedStepOrder === undefined) return;
    const selectedButton = buttonRefs.current[selectedStepOrder];
    selectedButton?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [selectedStepOrder]);

  return (
    <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:-mx-6 sm:px-6">
      <div className="flex gap-1.5 pb-2 min-w-max">
        {visibleSteps.map((step) => {
          const stepOrder = step.step_order ?? 0;
          const status = getStatus(step);
          const isSelected = selectedStepOrder === stepOrder;
          const title = step.step_name || `Step ${stepOrder}`;
          const shortTitle =
            title.length > 20 ? title.slice(0, 18) + "\u2026" : title;

          const pillBg: Record<StepStatus, string> = {
            completed: isSelected
              ? "bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700"
              : "bg-green-50 dark:bg-green-950/20 border-green-200/60 dark:border-green-800/40",
            failed: isSelected
              ? "bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700"
              : "bg-red-50 dark:bg-red-950/20 border-red-200/60 dark:border-red-800/40",
            in_progress: isSelected
              ? "bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700"
              : "bg-blue-50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-800/40",
            pending: isSelected
              ? "bg-muted border-border"
              : "bg-muted/40 border-border/50",
          };

          return (
            <button
              key={stepOrder}
              ref={(node) => {
                buttonRefs.current[stepOrder] = node;
              }}
              type="button"
              onClick={() => onSelectStep(stepOrder)}
              className={`
                flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs whitespace-nowrap
                transition-all shrink-0
                ${pillBg[status]}
                ${isSelected ? "shadow-sm font-semibold" : "font-medium opacity-80"}
              `}
            >
              <span className="flex items-center justify-center w-3.5 h-3.5 shrink-0">
                {STATUS_ICON[status]}
              </span>
              <span className="truncate max-w-[140px]">{shortTitle}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
