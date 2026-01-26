import { Artifact } from "@/types/artifact";
import { MergedStep } from "@/types/job";
import { formatLiveOutputText, formatStepOutput } from "@/utils/jobFormatting";

export type StepImageFile =
  | { type: "imageArtifact"; data: Artifact; key: string }
  | { type: "imageUrl"; data: string; key: string };

const getFilenameFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split("/").pop() || "";
    return filename;
  } catch {
    const parts = url.split("/");
    return parts[parts.length - 1] || url;
  }
};

const normalizeFilename = (filename: string): string =>
  filename.split("?")[0].toLowerCase();

const getArtifactFileName = (artifact: Artifact): string =>
  artifact.file_name || artifact.artifact_name || "";

const artifactMatchesImageUrl = (artifact: Artifact, imageUrl: string): boolean => {
  const artifactUrl = artifact.object_url || artifact.public_url;
  if (artifactUrl === imageUrl) return true;
  const artifactName = normalizeFilename(getArtifactFileName(artifact));
  const imageName = normalizeFilename(getFilenameFromUrl(imageUrl));
  return artifactName === imageName;
};

export const getStepImageFiles = (
  step: MergedStep,
  stepImageArtifacts: Artifact[],
): StepImageFile[] => {
  const stepImageUrls =
    step.image_urls && Array.isArray(step.image_urls) && step.image_urls.length > 0
      ? step.image_urls
      : [];
  const mainArtifactId = step.artifact_id;

  const displayedFiles = new Set<string>();
  const filesToShow: StepImageFile[] = [];

  if (mainArtifactId) {
    displayedFiles.add(`artifact:${mainArtifactId}`);
  }

  stepImageArtifacts.forEach((artifact) => {
    const artifactId = artifact.artifact_id;
    const normalizedName = normalizeFilename(getArtifactFileName(artifact));

    if (artifactId === mainArtifactId) {
      return;
    }

    if (normalizedName && displayedFiles.has(`filename:${normalizedName}`)) {
      return;
    }

    displayedFiles.add(`filename:${normalizedName}`);
    displayedFiles.add(`artifact:${artifactId}`);
    filesToShow.push({
      type: "imageArtifact",
      data: artifact,
      key: `image-artifact-${artifactId}`,
    });
  });

  stepImageUrls.forEach((imageUrl, idx) => {
    const normalizedName = normalizeFilename(getFilenameFromUrl(imageUrl));

    if (normalizedName && displayedFiles.has(`filename:${normalizedName}`)) {
      return;
    }

    const matchesExistingArtifact = stepImageArtifacts.some((artifact) =>
      artifactMatchesImageUrl(artifact, imageUrl),
    );

    if (matchesExistingArtifact) {
      return;
    }

    displayedFiles.add(`filename:${normalizedName}`);
    filesToShow.push({
      type: "imageUrl",
      data: imageUrl,
      key: `image-url-${idx}`,
    });
  });

  return filesToShow;
};

export const formatLivePreviewText = (value: string, maxLength = 160): string => {
  if (!value) return "";
  const formatted = formatLiveOutputText(value);
  const singleLine = formatted.replace(/\s+/g, " ").trim();
  if (!singleLine) return "";
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength - 3)}...`;
};

const MAX_OUTPUT_PREVIEW_CHARS = 50000;

const stripHtmlPreview = (value: string): string =>
  value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const buildOutputPreviewText = (
  step: MergedStep,
): {
  text: string;
  typeLabel: string;
  type: "json" | "markdown" | "text" | "html";
} | null => {
  const formatted = formatStepOutput(step);
  let raw: string;
  if (typeof formatted.content === "string") {
    raw = formatted.content;
  } else if (formatted.content === null || formatted.content === undefined) {
    return null;
  } else {
    raw = JSON.stringify(formatted.content, null, 2);
  }

  if (!raw) return null;
  const normalized =
    formatted.type === "html"
      ? stripHtmlPreview(raw)
      : formatted.type === "markdown"
        ? raw
        : formatLiveOutputText(raw);
  const trimmed = normalized.trim();
  if (!trimmed) return null;
  const text =
    trimmed.length > MAX_OUTPUT_PREVIEW_CHARS
      ? `${trimmed.slice(0, MAX_OUTPUT_PREVIEW_CHARS)}…`
      : trimmed;
  const typeLabel = formatted.type.toUpperCase();
  return { text, typeLabel, type: formatted.type };
};

export const formatLiveUpdatedAt = (value?: string | null): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};
