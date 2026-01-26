import type { Artifact } from "@/types/artifact";
import type { WorkflowAIImprovement, WorkflowImprovementStatus } from "@/types/workflow";

export const IMPROVEMENT_STATUS_META: Record<
  WorkflowImprovementStatus,
  {
    label: string;
    variant: "warning" | "success" | "destructive";
    description: string;
  }
> = {
  pending: {
    label: "Pending",
    variant: "warning",
    description: "Waiting for review",
  },
  approved: {
    label: "Approved",
    variant: "success",
    description: "Approved by reviewer",
  },
  denied: {
    label: "Denied",
    variant: "destructive",
    description: "Declined by reviewer",
  },
};

export type StepContextRow = {
  step_order: number;
  step_name: string;
  instructions: string;
  description: string;
  model: string;
  tools: string;
};

export type HistoryItem = {
  id: string;
  title: string;
  subtitle?: string;
  status?: WorkflowImprovementStatus;
  createdAt?: string;
  isCurrent?: boolean;
  improvement?: WorkflowAIImprovement | null;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const getStringValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

export const formatToolValue = (tool: unknown): string => {
  if (typeof tool === "string") return tool;
  if (isRecord(tool)) {
    if (typeof tool.type === "string") return tool.type;
    if (typeof tool.name === "string") return tool.name;
  }
  return "unknown";
};

export const formatTools = (tools: unknown): string => {
  if (Array.isArray(tools)) {
    return tools.length > 0 ? tools.map(formatToolValue).join(", ") : "N/A";
  }
  if (typeof tools === "string") return tools;
  return "N/A";
};

export const normalizeSearchText = (value: string) => value.trim().toLowerCase();

export const formatTimestamp = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

export const getStepKey = (step: StepContextRow) =>
  `${step.step_order}-${step.step_name}-${step.model}`;

export const isHtmlArtifact = (artifact: Artifact): boolean => {
  const contentType = (artifact.content_type || artifact.mime_type || "")
    .toLowerCase()
    .trim();
  if (contentType.includes("text/html")) return true;
  const fileName = (artifact.file_name || artifact.artifact_name || "")
    .toLowerCase()
    .trim();
  if (fileName.endsWith(".html") || fileName.endsWith(".htm")) return true;
  const artifactType = (artifact.artifact_type || "").toLowerCase();
  return artifactType.includes("html");
};

export const filterHtmlArtifacts = (list: Artifact[]) =>
  list.filter((artifact) => isHtmlArtifact(artifact));

export const buildContextRows = (steps: unknown[]): StepContextRow[] => {
  if (!Array.isArray(steps)) return [];
  return steps.map((step, index) => {
    const record = isRecord(step) ? step : {};
    const input = isRecord(record.input) ? record.input : null;
    const stepOrder =
      typeof record.step_order === "number" ? record.step_order : index + 1;
    const stepName =
      getStringValue(record.step_name) || `Step ${stepOrder}`;
    const instructions =
      getStringValue(record.instructions) ||
      getStringValue(input?.instructions) ||
      "N/A";
    const description =
      getStringValue(record.step_description) ||
      getStringValue(record.description) ||
      getStringValue(input?.description) ||
      "N/A";
    const model =
      getStringValue(record.model) || getStringValue(input?.model) || "N/A";
    const tools = formatTools(record.tools ?? input?.tools);

    return {
      step_order: stepOrder,
      step_name: stepName,
      instructions,
      description,
      model,
      tools,
    };
  });
};
