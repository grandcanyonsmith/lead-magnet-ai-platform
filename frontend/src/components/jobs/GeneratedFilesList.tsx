import React from "react";
import { FiCode, FiFileText, FiImage, FiFile } from "react-icons/fi";
import { OutputCardActions } from "@/components/jobs/detail/OutputCardActions";
import { Badge } from "@/components/ui/Badge";
import { Artifact } from "@/types/artifact";

interface GeneratedFilesListProps {
  fileArtifacts: Artifact[];
}

function toFriendlyFileTitle(artifact: Artifact, fallbackIndex: number): string {
  const rawName =
    artifact.file_name || artifact.artifact_name || `File ${fallbackIndex + 1}`;
  const contentType = artifact.content_type || artifact.mime_type || "";
  const withoutExtension = rawName.replace(/\.[^.]+$/, "");
  const withoutStepPrefix = withoutExtension
    .replace(/^step_\d+_/, "")
    .replace(/^step \d+\s*/i, "")
    .replace(/^step_\d+$/i, "");
  const humanized = withoutStepPrefix
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\(\s*/g, "(")
    .replace(/\s*\)/g, ")")
    .trim();

  if (!humanized) {
    if (contentType === "text/html") return "Final HTML output";
    if (contentType === "text/markdown") return "Markdown output";
    if (contentType === "application/json") return "JSON output";
    return `Generated file ${fallbackIndex + 1}`;
  }

  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}

function toFriendlyFileType(artifact: Artifact): string {
  const contentType = artifact.content_type || artifact.mime_type || "";
  if (contentType === "text/html") return "HTML file";
  if (contentType === "text/markdown") return "Markdown file";
  if (contentType === "application/json") return "JSON file";
  if (contentType.startsWith("image/")) return "Image file";
  if (!contentType) return "Generated file";
  return contentType;
}

function toFriendlyArtifactKind(artifact: Artifact): string | null {
  const raw = (artifact.artifact_type || "").trim();
  if (!raw) return null;

  const normalized = raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return null;

  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  const fileType = toFriendlyFileType(artifact).toLowerCase();
  return label.toLowerCase() === fileType ? null : label;
}

function formatBytes(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null;
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function getFileIcon(artifact: Artifact) {
  const contentType = artifact.content_type || artifact.mime_type || "";
  if (contentType === "text/html") {
    return {
      icon: <FiCode className="h-4 w-4" />,
      className:
        "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300",
    };
  }
  if (contentType === "text/markdown") {
    return {
      icon: <FiFileText className="h-4 w-4" />,
      className:
        "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300",
    };
  }
  if (contentType === "application/json") {
    return {
      icon: <FiCode className="h-4 w-4" />,
      className:
        "bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-300",
    };
  }
  if (contentType.startsWith("image/")) {
    return {
      icon: <FiImage className="h-4 w-4" />,
      className:
        "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300",
    };
  }
  return {
    icon: <FiFile className="h-4 w-4" />,
    className: "bg-muted text-muted-foreground",
  };
}

export function GeneratedFilesList({ fileArtifacts }: GeneratedFilesListProps) {
  if (!fileArtifacts || fileArtifacts.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 md:mt-2.5 pt-3 md:pt-2.5 border-t border-gray-200 dark:border-gray-700">
      <span className="text-sm md:text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2.5 md:mb-2 block">
        Generated Files:
      </span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {fileArtifacts.map((artifact, idx) => {
          const artifactUrl = artifact.object_url || artifact.public_url;
          const fileTitle = toFriendlyFileTitle(artifact, idx);
          const fileDescription = toFriendlyFileType(artifact);
          const artifactKind = toFriendlyArtifactKind(artifact);
          const sizeLabel = formatBytes(
            artifact.size_bytes || artifact.file_size_bytes,
          );
          const iconMeta = getFileIcon(artifact);

          return (
            <div
              key={artifact.artifact_id || idx}
              className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-card px-3 py-3 shadow-sm"
            >
              <div
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconMeta.className}`}
              >
                {iconMeta.icon}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="text-sm font-medium leading-snug text-foreground break-words">
                  {fileTitle}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant="secondary"
                    className="px-2 py-0.5 text-[10px] font-medium"
                  >
                    {fileDescription}
                  </Badge>
                  {artifactKind ? (
                    <Badge
                      variant="outline"
                      className="px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      {artifactKind}
                    </Badge>
                  ) : null}
                  {sizeLabel ? (
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {sizeLabel}
                    </span>
                  ) : null}
                </div>
              </div>
              {artifactUrl ? (
                <div className="shrink-0">
                  <OutputCardActions
                    url={artifactUrl}
                    artifactId={artifact.artifact_id}
                    contentType={artifact.content_type}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
