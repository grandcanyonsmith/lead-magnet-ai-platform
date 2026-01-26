import type { ComponentType } from "react";
import { Brain, ChevronDown, ChevronUp, Zap } from "lucide-react";
import type { StepStatus } from "@/types/job";
import { getToolName, type Tool } from "@/utils/stepMeta";
import { Badge } from "@/components/ui/badges/Badge";

const getToolDisplayLabel = (tool: Tool): string => {
  if (typeof tool === "string") return tool;
  if (!tool || typeof tool !== "object") return "unknown";
  if (tool.type === "mcp") {
    const serverLabel = tool.server_label?.trim() || null;
    const connectorId = tool.connector_id?.trim() || null;
    const serverUrl = tool.server_url?.trim() || null;
    if (serverLabel) return `mcp:${serverLabel}`;
    if (connectorId) return `mcp:${connectorId}`;
    if (serverUrl) {
      try {
        const parsed = new URL(serverUrl);
        if (parsed.hostname) return `mcp:${parsed.hostname}`;
      } catch {
        return `mcp:${serverUrl}`;
      }
    }
    return "mcp";
  }
  return getToolName(tool);
};

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
  onToggleModel,
  speedCount,
  speedLabel,
  showSpeedDetails,
  onToggleSpeed,
  reasoningCount,
  reasoningLabel,
  showReasoningDetails,
  onToggleReasoning,
  hasTools,
  toolList,
  hasImageGenerationTool,
  showImageSettings,
  onToggleImage,
  showTools,
  onToggleTools,
  hasContext,
  showContext,
  dependencyCount,
  onToggleContext,
  isInProgress,
  status,
}: StepMetaBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-400">
      {modelValue !== "Unknown" && (
        <Badge
          label={modelValue}
          icon={<ChevronDown className={`h-3 w-3 text-purple-400 ${showModelDetails ? "rotate-180" : ""}`} />}
          onClick={onToggleModel}
          variant="secondary"
          className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800/60 border"
          active={showModelDetails}
        />
      )}
      
      {speedCount && speedLabel && (
        <Badge
          icon={<Zap className="h-3 w-3 text-amber-500" />}
          label={`Speed: ${speedLabel}`}
          count={speedCount}
          onClick={onToggleSpeed}
          variant="secondary"
          className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800/60 border"
          active={showSpeedDetails}
        />
      )}

      {reasoningCount && reasoningLabel && (
        <Badge
          icon={<Brain className="h-3 w-3 text-indigo-500" />}
          label={`Reasoning: ${reasoningLabel}`}
          count={reasoningCount}
          onClick={onToggleReasoning}
          variant="secondary"
          className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800/60 border"
          active={showReasoningDetails}
        />
      )}

      {hasTools && Array.isArray(toolList) && toolList.map((tool, idx) => {
        const displayName = getToolDisplayLabel(tool as Tool);
        const isImageTool = getToolName(tool as Tool) === "image_generation";
        
        if (isImageTool && hasImageGenerationTool) {
          return (
            <Badge
              key={idx}
              label={displayName}
              icon={<ChevronDown className={`h-3 w-3 ${showImageSettings ? "rotate-180" : ""}`} />}
              onClick={onToggleImage}
              variant="secondary"
              className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800/60 border"
              active={showImageSettings}
            />
          );
        }
        
        return (
          <Badge
            key={idx}
            label={displayName}
            icon={onToggleTools ? <ChevronDown className={`h-3 w-3 ${showTools ? "rotate-180" : ""}`} /> : undefined}
            onClick={onToggleTools}
            variant="secondary"
            className="bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800/60 border"
            active={showTools}
          />
        );
      })}

      {hasContext && (
        <Badge
          label="Context"
          count={dependencyCount}
          icon={<ChevronDown className={`h-3 w-3 ${showContext ? "rotate-180" : ""}`} />}
          onClick={onToggleContext}
          variant="secondary"
          className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-800/60 border"
          active={showContext}
        />
      )}

      {isInProgress && (
        <Badge
          label="Processing..."
          variant="default"
          className="bg-blue-50 text-blue-700 border-blue-200 animate-pulse border"
        />
      )}

      {status === "failed" && (
        <Badge
          label="Failed"
          variant="destructive"
          className="bg-red-50 text-red-700 border-red-200 border"
        />
      )}
    </div>
  );
}
