"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { WorkflowStep } from "@/types/workflow";
import {
  FiZap,
  FiSearch,
  FiImage,
  FiCode,
  FiFile,
  FiMonitor,
  FiAlertCircle,
  FiMove,
  FiCheckCircle,
} from "react-icons/fi";

interface FlowchartNodeData {
  step: WorkflowStep;
  index: number;
  onClick: () => void;
  onHover?: (isHovering: boolean) => void;
  isActive?: boolean;
  isHovered?: boolean;
  isDropTarget?: boolean;
  isDragging?: boolean;
  warnings?: string[];
  animateIn?: boolean;
}

const MODEL_STYLES: Record<
  string,
  {
    badge: string;
    accent: string;
  }
> = {
  "gpt-5": {
    badge: "bg-blue-100 text-blue-800 border-blue-300",
    accent: "from-blue-100/70",
  },
  "gpt-5.2": {
    badge: "bg-blue-100 text-blue-800 border-blue-300",
    accent: "from-blue-100/70",
  },
  "gpt-4.1": {
    badge: "bg-indigo-100 text-indigo-800 border-indigo-300",
    accent: "from-indigo-100/70",
  },
  "gpt-4-turbo": {
    badge: "bg-teal-100 text-teal-800 border-teal-300",
    accent: "from-teal-100/70",
  },
  "gpt-3.5-turbo": {
    badge: "bg-slate-100 text-slate-800 border-slate-300",
    accent: "from-slate-100/70",
  },
  "computer-use-preview": {
    badge: "bg-amber-100 text-amber-800 border-amber-300",
    accent: "from-amber-100/70",
  },
  "o4-mini-deep-research": {
    badge: "bg-purple-100 text-purple-800 border-purple-300",
    accent: "from-purple-100/70",
  },
};

const TOOL_ICONS: Record<
  string,
  { icon: typeof FiZap; label: string; tint: string }
> = {
  web_search: {
    icon: FiSearch,
    label: "Web Search",
    tint: "bg-blue-100 text-blue-600",
  },
  image_generation: {
    icon: FiImage,
    label: "Image Generation",
    tint: "bg-violet-100 text-violet-600",
  },
  computer_use_preview: {
    icon: FiMonitor,
    label: "Computer Use",
    tint: "bg-amber-100 text-amber-600",
  },
  file_search: {
    icon: FiFile,
    label: "File Search",
    tint: "bg-emerald-100 text-emerald-600",
  },
  code_interpreter: {
    icon: FiCode,
    label: "Code Interpreter",
    tint: "bg-slate-100 text-slate-600",
  },
};

function FlowchartNode({ data, selected }: NodeProps<FlowchartNodeData>) {
  const {
    step,
    index,
    onClick,
    onHover,
    isActive,
    isHovered,
    isDropTarget,
    isDragging,
    warnings = [],
    animateIn,
  } = data;

  const modelStyle = MODEL_STYLES[step.model] || MODEL_STYLES["gpt-5"];
  const tools = step.tools || [];
  const hasTools = tools.length > 0;
  const hasWarnings = warnings.length > 0;
  const handleKeyPress = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      onClick={onClick}
      onKeyDown={handleKeyPress}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      className={[
        "group relative w-[260px] max-w-[280px] cursor-pointer select-none rounded-2xl border transition-all duration-200",
        "bg-white/90 backdrop-blur-sm px-4 pb-4 pt-3 shadow-[0_12px_30px_-15px_rgba(30,64,175,0.45)]",
        isActive
          ? "border-primary-200 ring-2 ring-primary-300 shadow-primary-200/70"
          : "border-slate-200 hover:border-primary-200 hover:ring-1 hover:ring-primary-200/70",
        isHovered ? "translate-y-[-2px]" : "",
        isDropTarget
          ? "border-dashed border-primary-400 shadow-[0_0_35px_-20px,#2563eb]"
          : "",
        isDragging
          ? "scale-[1.02] shadow-xl shadow-primary-200/60 opacity-95"
          : "",
        animateIn ? "flow-node-animate-in" : "",
      ].join(" ")}
    >
      <div
        className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${modelStyle.accent} to-white opacity-70`}
      />

      <Handle
        type="target"
        position={Position.Left}
        className="h-3 w-3 rounded-full border-2 border-white bg-primary-500"
      />

      <div className="relative z-10 space-y-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Step {index + 1}
            {isActive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-700">
                <FiCheckCircle className="h-3 w-3" aria-hidden />
                Active
              </span>
            )}
            {isDropTarget && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                Drop Here
              </span>
            )}
          </span>
          <button
            className="flow-node-drag-handle inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 text-[11px] font-medium text-slate-500 shadow-sm transition-colors hover:text-slate-700"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Drag step ${index + 1}`}
          >
            <FiMove className="h-4 w-4" aria-hidden />
            Drag
          </button>
        </div>

        <div className="space-y-1">
          <h3 className="line-clamp-2 text-base font-semibold text-slate-900">
            {step.step_name || `Step ${index + 1}`}
          </h3>
          <p className="line-clamp-2 text-sm text-slate-500">
            {step.step_description || "No description provided yet."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${modelStyle.badge}`}
          >
            {step.model === "computer-use-preview"
              ? "Computer Use Preview"
              : step.model.replace("gpt-", "GPT-").replace("turbo", "Turbo")}
          </span>
          {step.tool_choice && step.tool_choice !== "none" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
              {step.tool_choice === "required"
                ? "Tools Required"
                : "Tools Auto"}
            </span>
          )}
        </div>

        {hasTools && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50/80 px-3 py-2 text-[11px] text-slate-500">
            {tools.slice(0, 3).map((tool, idx) => {
              const toolKey = typeof tool === "string" ? tool : tool.type;
              const toolMeta = TOOL_ICONS[toolKey] || {
                icon: FiZap,
                label: toolKey,
                tint: "bg-slate-100 text-slate-600",
              };
              const Icon = toolMeta.icon;
              return (
                <span
                  key={`${toolKey}-${idx}`}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium ${toolMeta.tint}`}
                  title={toolMeta.label}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {toolMeta.label}
                </span>
              );
            })}
            {tools.length > 3 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/70 px-2 py-1 font-medium text-slate-600">
                +{tools.length - 3} more
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>
            {step.instructions?.trim()
              ? `${step.instructions.trim().split(" ").length} words`
              : "No instructions yet"}
          </span>
          <span>
            {step.tools?.length ? `${step.tools.length} tools` : "No tools"}
          </span>
        </div>

        {hasWarnings && (
          <div className="space-y-1 rounded-xl bg-rose-50 px-3 py-2 text-[11px] text-rose-600 shadow-inner shadow-rose-100/60">
            <div className="flex items-center gap-2 font-semibold uppercase tracking-wide text-rose-500">
              <FiAlertCircle className="h-4 w-4" aria-hidden />
              Attention Needed
            </div>
            <ul className="ml-5 list-disc space-y-1 marker:text-rose-400">
              {warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/30 shadow-inner shadow-white/30 transition-opacity group-hover:opacity-100" />

      <Handle
        type="source"
        position={Position.Right}
        className="h-3 w-3 rounded-full border-2 border-white bg-primary-500"
      />
    </div>
  );
}

export default memo(FlowchartNode);
