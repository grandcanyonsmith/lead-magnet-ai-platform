import { MergedStep } from "@/types/job";
import type { Tool as WorkflowTool } from "@/types/workflow";

export type Tool = WorkflowTool;

export const SERVICE_TIER_SPEED: Record<string, number> = {
  flex: 1,
  default: 2,
  scale: 3,
  priority: 4,
};

export const REASONING_EFFORT_LEVELS: Record<string, number> = {
  none: 1,
  low: 2,
  medium: 3,
  high: 4,
  xhigh: 5,
};

export const SERVICE_TIER_LABELS: Record<string, string> = {
  flex: "Flex",
  default: "Default",
  scale: "Scale",
  priority: "Priority",
};

export const REASONING_EFFORT_LABELS: Record<string, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra High",
};

export const getRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const getString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

export const getNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getReasoningEffortFromValue = (value: unknown): string | null => {
  const direct = getString(value);
  if (direct) return direct;
  const record = getRecord(value);
  return record ? getString(record.effort) : null;
};

export const extractServiceTier = (step: MergedStep): string | null => {
  const input = getRecord(step.input);
  return (
    getString((step as { service_tier?: unknown }).service_tier) ||
    getString(input?.service_tier)
  );
};

export const extractReasoningEffort = (step: MergedStep): string | null => {
  const input = getRecord(step.input);
  return (
    getReasoningEffortFromValue(
      (step as { reasoning_effort?: unknown }).reasoning_effort,
    ) ||
    getReasoningEffortFromValue(input?.reasoning_effort) ||
    getReasoningEffortFromValue(input?.reasoning)
  );
};

export function getToolName(tool: Tool): string {
  return typeof tool === "string" ? tool : tool.type || "unknown";
}
