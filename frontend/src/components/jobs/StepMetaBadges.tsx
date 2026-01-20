import type { ComponentType } from "react";
import { Brain, ChevronDown, ChevronUp, Zap } from "lucide-react";
import type { StepStatus } from "@/types/job";
import { getToolName, type Tool } from "@/utils/stepMeta";

type BadgeIcon = ComponentType<{ className?: string }>;

const HOVER_CHEVRON_CLASS =
  "opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100";

// Render tool badges inline
function renderToolBadges({
  tools,
  onImageToggle,
  imageExpanded,
  imageControlsId,
  onToolsToggle,
  toolsExpanded,
  toolsControlsId,
}: {
  tools?: string[] | unknown[];
  onImageToggle?: () => void;
  imageExpanded?: boolean;
  imageControlsId?: string;
  onToolsToggle?: () => void;
  toolsExpanded?: boolean;
  toolsControlsId?: string;
}) {
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
        const isImageTool = toolName === "image_generation";
        const baseClass =
          "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md border whitespace-nowrap";
        const defaultBadgeClass = `${baseClass} bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800/60`;
        const imageBadgeClass = `${baseClass} bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-200 dark:border-indigo-800/60`;
        const imageActiveClass = imageExpanded
          ? "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/60 dark:text-indigo-100 dark:border-indigo-700/60"
          : "hover:bg-indigo-100 dark:hover:bg-indigo-900/50";
        const buttonClass = `${imageBadgeClass} ${imageActiveClass} transition-all cursor-pointer shadow-sm hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-1 dark:focus-visible:ring-indigo-700 group`;

        if (isImageTool && onImageToggle) {
          const ToggleIcon = imageExpanded ? ChevronUp : ChevronDown;
          return (
            <button
              key={toolIdx}
              type="button"
              onClick={onImageToggle}
              aria-expanded={imageExpanded}
              aria-controls={imageControlsId}
              aria-pressed={imageExpanded}
              className={buttonClass}
              title="Toggle image generation settings"
            >
              <span>{toolName}</span>
              <ToggleIcon
                className={`h-3 w-3 ${HOVER_CHEVRON_CLASS}`}
                aria-hidden="true"
              />
            </button>
          );
        }
        if (onToolsToggle) {
          const ToggleIcon = toolsExpanded ? ChevronUp : ChevronDown;
          return (
            <button
              key={toolIdx}
              type="button"
              onClick={onToolsToggle}
              aria-expanded={toolsExpanded}
              aria-controls={toolsControlsId}
              aria-pressed={toolsExpanded}
              className={`${defaultBadgeClass} transition-all cursor-pointer shadow-sm hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-1 dark:focus-visible:ring-slate-700 group`}
              title="Toggle tool details"
            >
              <span>{toolName}</span>
              <ToggleIcon
                className={`h-3 w-3 ${HOVER_CHEVRON_CLASS}`}
                aria-hidden="true"
              />
            </button>
          );
        }
        return (
          <span key={toolIdx} className={defaultBadgeClass}>
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
  showChevron = false,
  chevronClassName,
  onClick,
  isExpanded,
  controlsId,
}: {
  count: number;
  Icon: BadgeIcon;
  label: string;
  className: string;
  iconClassName: string;
  showChevron?: boolean;
  chevronClassName?: string;
  onClick?: () => void;
  isExpanded?: boolean;
  controlsId?: string;
}) {
  if (!count || count < 1) return null;
  const ChevronIcon = isExpanded ? ChevronUp : ChevronDown;
  const content = (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <Icon key={`${label}-${idx}`} className={iconClassName} aria-hidden="true" />
      ))}
      {showChevron && (
        <ChevronIcon
          className={chevronClassName || "h-3 w-3 text-current/70"}
          aria-hidden="true"
        />
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-expanded={isExpanded}
        aria-controls={controlsId}
        aria-pressed={isExpanded}
        aria-label={label}
        title={label}
        className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 ${className} cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-1`}
      >
        {content}
      </button>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 ${className}`}
      role="img"
      aria-label={label}
      title={label}
    >
      {content}
    </span>
  );
}

export type StepMetaBadgesProps = {
  modelValue: string;
  showModelDetails: boolean;
  modelDetailsId: string;
  modelBadgeClass: string;
  onToggleModel: () => void;
  speedCount?: number;
  speedLabel?: string;
  speedBadgeClass: string;
  showSpeedDetails: boolean;
  speedDetailsId: string;
  onToggleSpeed: () => void;
  reasoningCount?: number;
  reasoningLabel?: string;
  reasoningBadgeClass: string;
  showReasoningDetails: boolean;
  reasoningDetailsId: string;
  onToggleReasoning: () => void;
  hasTools: boolean;
  toolList: unknown[];
  hasImageGenerationTool: boolean;
  showImageSettings: boolean;
  imageSettingsId: string;
  onToggleImage: () => void;
  showTools: boolean;
  toolsId: string;
  onToggleTools: () => void;
  hasContext: boolean;
  showContext: boolean;
  contextId: string;
  contextButtonClass: string;
  dependencyCount: number;
  onToggleContext: () => void;
  isInProgress: boolean;
  status: StepStatus;
};

export function StepMetaBadges({
  modelValue,
  showModelDetails,
  modelDetailsId,
  modelBadgeClass,
  onToggleModel,
  speedCount,
  speedLabel,
  speedBadgeClass,
  showSpeedDetails,
  speedDetailsId,
  onToggleSpeed,
  reasoningCount,
  reasoningLabel,
  reasoningBadgeClass,
  showReasoningDetails,
  reasoningDetailsId,
  onToggleReasoning,
  hasTools,
  toolList,
  hasImageGenerationTool,
  showImageSettings,
  imageSettingsId,
  onToggleImage,
  showTools,
  toolsId,
  onToggleTools,
  hasContext,
  showContext,
  contextId,
  contextButtonClass,
  dependencyCount,
  onToggleContext,
  isInProgress,
  status,
}: StepMetaBadgesProps) {
  const ContextToggleIcon = showContext ? ChevronUp : ChevronDown;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-400">
      {modelValue !== "Unknown" && (
        <button
          type="button"
          onClick={onToggleModel}
          aria-expanded={showModelDetails}
          aria-controls={modelDetailsId}
          aria-pressed={showModelDetails}
          className={modelBadgeClass}
        >
          <span>{modelValue}</span>
          <ChevronDown
            className={`h-3 w-3 text-purple-400 dark:text-purple-300/80 ${HOVER_CHEVRON_CLASS}`}
            aria-hidden="true"
          />
        </button>
      )}
      {speedCount &&
        speedLabel &&
        renderIconBadge({
          count: speedCount,
          Icon: Zap,
          label: `Speed: ${speedLabel}`,
          className: `${speedBadgeClass} shadow-sm`,
          iconClassName: "h-3 w-3 text-amber-500",
          showChevron: true,
          chevronClassName: `h-3 w-3 text-amber-400/90 ${HOVER_CHEVRON_CLASS}`,
          onClick: onToggleSpeed,
          isExpanded: showSpeedDetails,
          controlsId: speedDetailsId,
        })}
      {reasoningCount &&
        reasoningLabel &&
        renderIconBadge({
          count: reasoningCount,
          Icon: Brain,
          label: `Reasoning: ${reasoningLabel}`,
          className: `${reasoningBadgeClass} shadow-sm`,
          iconClassName: "h-3 w-3 text-indigo-500",
          showChevron: true,
          chevronClassName: `h-3 w-3 text-indigo-400/90 ${HOVER_CHEVRON_CLASS}`,
          onClick: onToggleReasoning,
          isExpanded: showReasoningDetails,
          controlsId: reasoningDetailsId,
        })}
      {hasTools && (
        <div className="flex items-center gap-1.5">
          {renderToolBadges({
            tools: toolList,
            onImageToggle: hasImageGenerationTool ? onToggleImage : undefined,
            imageExpanded: showImageSettings,
            imageControlsId: imageSettingsId,
            onToolsToggle: onToggleTools,
            toolsExpanded: showTools,
            toolsControlsId: toolsId,
          })}
        </div>
      )}
      {hasContext && (
        <button
          type="button"
          aria-expanded={showContext}
          aria-controls={contextId}
          aria-pressed={showContext}
          onClick={onToggleContext}
          className={contextButtonClass}
        >
          <span>Context</span>
          {dependencyCount > 0 && (
            <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[9px] font-semibold text-teal-700 dark:bg-teal-900/60 dark:text-teal-200">
              {dependencyCount}
            </span>
          )}
          <ContextToggleIcon
            className={`h-3 w-3 ${HOVER_CHEVRON_CLASS}`}
            aria-hidden="true"
          />
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
  );
}
