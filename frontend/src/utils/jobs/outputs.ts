import type { ArtifactGalleryItem } from "@/types/job";

export type OutputGroupKey = "step_output" | "image" | "html" | "logs";

export interface OutputGroupMeta {
  key: OutputGroupKey;
  label: string;
  badgeClassName: string;
}

export interface OutputGroupViewModel extends OutputGroupMeta {
  items: ArtifactGalleryItem[];
  count: number;
}

export interface OutputPreviewMeta {
  objectUrl?: string;
  fileName?: string;
  contentType?: string;
  artifactId?: string;
}

const OUTPUT_GROUP_ORDER: OutputGroupKey[] = [
  "html",
  "image",
  "step_output",
  "logs",
];

const OUTPUT_GROUP_META: Record<OutputGroupKey, Omit<OutputGroupMeta, "key">> = {
  html: {
    label: "HTML",
    badgeClassName:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
  },
  image: {
    label: "Images",
    badgeClassName:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  },
  step_output: {
    label: "Other",
    badgeClassName:
      "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200",
  },
  logs: {
    label: "Logs",
    badgeClassName:
      "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200",
  },
};

const TYPE_DESCRIPTIONS_BY_GROUP: Record<OutputGroupKey, string[]> = {
  step_output: ["step output", "step outputs", "output", "outputs"],
  image: ["image", "images"],
  html: ["html", "html output", "html outputs", "html final", "final html"],
  logs: ["log", "logs"],
};

const getArtifactFileName = (item: ArtifactGalleryItem) =>
  item.artifact?.file_name || item.artifact?.artifact_name || item.label || "";

export const getOutputUrl = (item: ArtifactGalleryItem) =>
  item.artifact?.object_url || item.artifact?.public_url || item.url || "";

const isImageOutput = (item: ArtifactGalleryItem) => {
  const artifactType = String(item.artifact?.artifact_type || "").toLowerCase();
  const contentType = String(item.artifact?.content_type || "").toLowerCase();
  return (
    item.kind === "imageUrl" ||
    item.kind === "imageArtifact" ||
    contentType.startsWith("image/") ||
    artifactType.includes("image")
  );
};

const isLogOutput = (item: ArtifactGalleryItem) => {
  const artifactType = String(item.artifact?.artifact_type || "").toLowerCase();
  const fileName = getArtifactFileName(item).toLowerCase();
  return (
    artifactType.includes("shell_executor_logs") ||
    artifactType.includes("code_executor_logs") ||
    artifactType.includes("executor_logs") ||
    fileName.includes("shell_executor_logs") ||
    fileName.includes("code_executor_logs") ||
    fileName.includes("executor_logs")
  );
};

const isHtmlOutput = (item: ArtifactGalleryItem) => {
  const artifactType = String(item.artifact?.artifact_type || "").toLowerCase();
  const contentType = String(item.artifact?.content_type || "").toLowerCase();
  const fileName = getArtifactFileName(item).toLowerCase();
  const rawUrl = getOutputUrl(item);
  const normalizedUrlPath = (() => {
    try {
      return rawUrl ? new URL(rawUrl).pathname.toLowerCase() : "";
    } catch {
      return String(rawUrl || "").toLowerCase();
    }
  })();

  return (
    artifactType.includes("html") ||
    contentType.includes("text/html") ||
    fileName.endsWith(".html") ||
    fileName.endsWith(".htm") ||
    normalizedUrlPath.endsWith(".html") ||
    normalizedUrlPath.endsWith(".htm")
  );
};

export const getOutputGroupKey = (item: ArtifactGalleryItem): OutputGroupKey => {
  if (isLogOutput(item)) return "logs";
  if (isImageOutput(item)) return "image";
  if (isHtmlOutput(item)) return "html";
  return "step_output";
};

export const getOutputGroupMeta = (key: OutputGroupKey): OutputGroupMeta => ({
  key,
  ...OUTPUT_GROUP_META[key],
});

export const buildOutputGroups = (
  items: ArtifactGalleryItem[],
): OutputGroupViewModel[] => {
  const grouped: Record<OutputGroupKey, ArtifactGalleryItem[]> = {
    step_output: [],
    image: [],
    html: [],
    logs: [],
  };

  items.forEach((item) => {
    grouped[getOutputGroupKey(item)].push(item);
  });

  return OUTPUT_GROUP_ORDER.map((key) => ({
    key,
    label: OUTPUT_GROUP_META[key].label,
    badgeClassName: OUTPUT_GROUP_META[key].badgeClassName,
    items: grouped[key],
    count: grouped[key].length,
  }));
};

export const getOutputLabel = (
  item: ArtifactGalleryItem,
  groupKey: OutputGroupKey,
) => {
  const rawLabel = String(item.label || "").trim();
  const fileName = getArtifactFileName(item);
  const fileLabel = fileName.replace(/\.(html?|pdf)$/i, "").trim();

  if (groupKey === "html") {
    const cleanHtmlLabel = (value: string) =>
      value
        .replace(/html\s*final/gi, "")
        .replace(/[-_:]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const cleaned = cleanHtmlLabel(rawLabel);
    const cleanedFileLabel = cleanHtmlLabel(fileLabel);
    return cleaned || cleanedFileLabel || "HTML output";
  }

  return rawLabel || fileLabel;
};

export const shouldShowOutputDescription = (
  groupKey: OutputGroupKey,
  description?: string,
) => {
  if (!description) return false;
  const normalized = description.trim().toLowerCase();
  if (!normalized) return false;
  return !TYPE_DESCRIPTIONS_BY_GROUP[groupKey].includes(normalized);
};

export const getOutputPreviewMeta = (
  item: ArtifactGalleryItem,
): OutputPreviewMeta => {
  const artifact = item.artifact;
  return {
    objectUrl: artifact?.object_url || artifact?.public_url || item.url,
    fileName: artifact?.file_name || artifact?.artifact_name || item.label,
    contentType:
      artifact?.content_type || (item.kind === "imageUrl" ? "image/png" : undefined),
    artifactId: artifact?.artifact_id,
  };
};
