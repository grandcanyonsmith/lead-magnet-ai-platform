import type { MergedStep } from "@/types/job";
import type { AIModel, ReasoningEffort } from "@/types/workflow";

export type EditablePanel = "model" | "speed" | "reasoning";
export type ReasoningEffortOption = ReasoningEffort | "auto";
export type DetailRow = {
  label: string;
  value: string;
  muted?: boolean;
};
export type ImageSettingRow = DetailRow & {
  highlighted?: boolean;
};
export type ToolDetail = {
  id: string;
  name: string;
  config: Record<string, unknown> | null;
};
export type DependencyItem = {
  index: number;
  label: string;
};
export type DependencyPreview = {
  dependency: DependencyItem;
  step: MergedStep;
};
export type ModelRestriction = {
  allowedModels: Set<AIModel> | null;
  reason: string | null;
};
