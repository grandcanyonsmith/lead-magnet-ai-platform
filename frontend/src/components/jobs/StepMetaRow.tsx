import { useState, type ComponentType } from "react";
import { Brain, Zap } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { MergedStep, StepStatus } from "@/types/job";
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

// Render tool badges inline
function renderToolBadges(tools?: string[] | unknown[]) {
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
        return (
          <span
            key={toolIdx}
            className="px-1.5 py-0.5 text-[10px] font-semibold bg-primary-50 text-primary-700 rounded-md border border-primary-100 whitespace-nowrap"
          >
            {toolName}
          </span>
        );
      })}
    </div>
  );
}

function renderIconBadge({
  count,
  Icon,
  label,
  className,
  iconClassName,
}: {
  count: number;
  Icon: BadgeIcon;
  label: string;
  className: string;
  iconClassName: string;
}) {
  if (!count || count < 1) return null;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 ${className}`}
      role="img"
      aria-label={label}
      title={label}
    >
      {Array.from({ length: count }).map((_, idx) => (
        <Icon key={`${label}-${idx}`} className={iconClassName} aria-hidden="true" />
      ))}
    </span>
  );
}

interface StepMetaRowProps {
  step: MergedStep;
  status: StepStatus;
  allSteps?: MergedStep[];
}

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

export function StepMetaRow({ step, status, allSteps }: StepMetaRowProps) {
  const isInProgress = status === "in_progress";
  const [showContext, setShowContext] = useState(false);
  const instructions = step.instructions?.trim();
  const contextId = `step-context-${step.step_order ?? "unknown"}`;
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
  const serviceTier = extractServiceTier(step);
  const normalizedServiceTier = serviceTier?.toLowerCase();
  const speedCount =
    normalizedServiceTier && normalizedServiceTier !== "auto"
      ? SERVICE_TIER_SPEED[normalizedServiceTier]
      : undefined;
  const speedLabel = normalizedServiceTier
    ? SERVICE_TIER_LABELS[normalizedServiceTier]
    : undefined;
  const reasoningEffort = extractReasoningEffort(step);
  const normalizedReasoningEffort = reasoningEffort?.toLowerCase();
  const reasoningCount = normalizedReasoningEffort
    ? REASONING_EFFORT_LEVELS[normalizedReasoningEffort]
    : undefined;
  const reasoningLabel = normalizedReasoningEffort
    ? REASONING_EFFORT_LABELS[normalizedReasoningEffort]
    : undefined;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-400">
        {step.model && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50/50 dark:bg-purple-900/30 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:text-purple-300 border border-purple-100/50 dark:border-purple-800/30">
            {step.model}
          </span>
        )}
        {speedCount &&
          speedLabel &&
          renderIconBadge({
            count: speedCount,
            Icon: Zap,
            label: `Speed: ${speedLabel}`,
            className:
              "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800/40",
            iconClassName: "h-3 w-3 text-amber-500",
          })}
        {reasoningCount &&
          reasoningLabel &&
          renderIconBadge({
            count: reasoningCount,
            Icon: Brain,
            label: `Reasoning: ${reasoningLabel}`,
            className:
              "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-200 dark:border-indigo-800/40",
            iconClassName: "h-3 w-3 text-indigo-500",
          })}
        {((step.input?.tools && step.input.tools.length > 0) ||
          (step.tools && step.tools.length > 0)) && (
          <div className="flex items-center gap-1.5">
            {renderToolBadges(step.input?.tools || step.tools)}
          </div>
        )}
        {hasContext && (
          <button
            type="button"
            aria-expanded={showContext}
            aria-controls={contextId}
            onClick={() => setShowContext((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-md border whitespace-nowrap bg-teal-50 text-teal-700 border-teal-200 transition-colors hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-200 dark:border-teal-800/50 dark:hover:bg-teal-900/50"
          >
            <span>Context</span>
            {dependencyItems.length > 0 && (
              <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[9px] font-semibold text-teal-700 dark:bg-teal-900/60 dark:text-teal-200">
                {dependencyItems.length}
              </span>
            )}
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
      {hasContext && showContext && (
        <div
          id={contextId}
          className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-foreground/90 space-y-3"
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
                <div className="grid grid-flow-col auto-cols-[16rem] grid-rows-1 gap-3 overflow-x-auto pb-2 pl-3 pr-1 sm:-mx-1 sm:px-1 snap-x snap-mandatory scrollbar-hide">
                  {dependencyPreviews.map(({ dependency, step: dependencyStep }) => (
                    <div
                      key={`dependency-context-${dependencyStep.step_order ?? dependency.index}`}
                      title={dependency.label}
                      className="group flex w-64 flex-shrink-0 snap-start flex-col text-left"
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
