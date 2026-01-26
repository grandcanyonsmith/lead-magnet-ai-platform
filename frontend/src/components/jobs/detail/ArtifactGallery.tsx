import { useState } from "react";
import { EyeIcon, PencilSquareIcon, PhotoIcon } from "@heroicons/react/24/outline";
import { PreviewCard } from "@/components/artifacts/PreviewCard";
import { OutputPreview } from "@/components/jobs/detail/OutputPreview";
import { OutputCardActions } from "@/components/jobs/detail/OutputCardActions";
import { openJobDocumentInNewTab } from "@/utils/jobs/openJobDocument";
import type { ArtifactGalleryItem } from "@/types/job";
import { Tooltip } from "@/components/ui/Tooltip";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import {
  getOutputGroupKey,
  getOutputLabel,
  getOutputPreviewMeta,
  getOutputUrl,
  shouldShowOutputDescription,
} from "@/utils/jobs/outputs";

interface ArtifactGalleryProps {
  items: ArtifactGalleryItem[];
  loading: boolean;
  onPreview: (item: ArtifactGalleryItem) => void;
}

function groupFinalHtmlArtifacts(
  items: ArtifactGalleryItem[],
): ArtifactGalleryItem[] {
  const groups = new Map<string, ArtifactGalleryItem[]>();
  const passthrough: ArtifactGalleryItem[] = [];

  for (const item of items) {
    const artifactType = String(
      item.artifact?.artifact_type || "",
    ).toLowerCase();
    const fileName = String(
      item.artifact?.file_name || item.artifact?.artifact_name || "",
    ).toLowerCase();

    // Group repeated html_final artifacts (commonly "final.html") into a single card.
    if (item.kind === "artifact" && artifactType === "html_final" && fileName) {
      const key = `${artifactType}:${fileName}`;
      const arr = groups.get(key) || [];
      arr.push(item);
      groups.set(key, arr);
      continue;
    }

    passthrough.push(item);
  }

  const grouped: ArtifactGalleryItem[] = [];
  for (const [key, versions] of groups.entries()) {
    if (versions.length <= 1) {
      grouped.push(versions[0]);
      continue;
    }

    const latest = versions.reduce(
      (acc, cur) => ((cur.sortOrder ?? 0) > (acc.sortOrder ?? 0) ? cur : acc),
      versions[0],
    );
    const versionNumber = versions.length;
    const baseDescription =
      latest.description ||
      latest.artifact?.artifact_type?.replace(/_/g, " ") ||
      latest.artifact?.file_name ||
      "html final";

    grouped.push({
      ...latest,
      id: `group-${key}`,
      description: `${baseDescription} · v${versionNumber}`,
    });
  }

  return [...passthrough, ...grouped].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
}

export function ArtifactGallery({
  items,
  loading,
  onPreview,
}: ArtifactGalleryProps) {
  const displayItems = groupFinalHtmlArtifacts(items);

  if (loading && items.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse p-4">
            <div className="aspect-[4/3] w-full rounded-xl bg-gray-100 dark:bg-gray-800" />
            <div className="mt-4 space-y-2">
              <div className="h-4 w-3/4 rounded bg-gray-100 dark:bg-gray-800" />
              <div className="h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        title="No artifacts generated"
        message="Artifacts will appear here once the job completes successfully."
        icon={<PhotoIcon className="h-6 w-6 text-gray-400 dark:text-gray-500" />}
        className="rounded-2xl border border-dashed border-border bg-muted/40"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ contain: 'layout' }}>
      {displayItems.map((item) => (
        <ArtifactCard key={item.id} item={item} onPreview={onPreview} />
      ))}
    </div>
  );
}

interface ArtifactCardProps {
  item: ArtifactGalleryItem;
  onPreview: (item: ArtifactGalleryItem) => void;
}

function ArtifactCard({ item, onPreview }: ArtifactCardProps) {
  const artifactUrl = getOutputUrl(item);
  const fileName =
    item.artifact?.file_name ||
    item.artifact?.artifact_name ||
    (item.kind === "autoUpload" ? item.label : item.url) ||
    item.label ||
    "Artifact";
  const [openingJobOutput, setOpeningJobOutput] = useState(false);

  const editorJobId = item.jobId || item.artifact?.job_id;
  const editorHref = editorJobId
    ? `/dashboard/editor?jobId=${editorJobId}&artifactId=${item.artifact?.artifact_id || ""}&url=${encodeURIComponent(artifactUrl || "")}`
    : null;

  const normalizedFileName = fileName.toLowerCase();
  const normalizedContentType = String(
    item.artifact?.content_type || "",
  ).toLowerCase();
  const normalizedUrlPath = (() => {
    try {
      return artifactUrl ? new URL(artifactUrl).pathname.toLowerCase() : "";
    } catch {
      return String(artifactUrl || "").toLowerCase();
    }
  })();

  const isHtml =
    normalizedContentType.includes("text/html") ||
    normalizedFileName.endsWith(".html") ||
    normalizedFileName.endsWith(".htm") ||
    normalizedUrlPath.endsWith(".html") ||
    normalizedUrlPath.endsWith(".htm");

  const handleViewJobOutput = async () => {
    if (!item.jobId || openingJobOutput) return;

    setOpeningJobOutput(true);

    try {
      await openJobDocumentInNewTab(item.jobId);
    } finally {
      setOpeningJobOutput(false);
    }
  };

  const isImage =
    item.kind === "imageUrl" ||
    item.kind === "imageArtifact" ||
    item.artifact?.content_type?.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|svg)$/i.test(fileName);

  const isCode =
    item.artifact?.content_type === "text/html" ||
    item.artifact?.content_type === "application/json" ||
    item.artifact?.content_type === "text/markdown" ||
    fileName.endsWith(".html") ||
    fileName.endsWith(".json") ||
    fileName.endsWith(".md");

  const groupKey = getOutputGroupKey(item);
  const preview = getOutputPreviewMeta(item);
  const displayLabel = getOutputLabel(item, groupKey);
  const showDescription = shouldShowOutputDescription(groupKey, item.description);

  const footerMeta =
    item.kind === "jobOutput" && item.jobId ? (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={(event) => {
          event.stopPropagation();
          void handleViewJobOutput();
        }}
        disabled={openingJobOutput}
        className="h-7 px-2.5 text-xs"
      >
        {openingJobOutput ? (
          <span className="animate-pulse">Opening...</span>
        ) : (
          <>
            <EyeIcon className="h-3.5 w-3.5" />
            View Output
          </>
        )}
      </Button>
    ) : null;

  const footerActions = artifactUrl ? (
    <div className="flex items-center gap-1">
      {isHtml && editorHref ? (
        <Tooltip content="Open in AI Editor" position="top">
          <Link
            href={editorHref}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </Link>
        </Tooltip>
      ) : null}
      <OutputCardActions url={artifactUrl} />
    </div>
  ) : isHtml && editorHref ? (
    <Tooltip content="Open in AI Editor" position="top">
      <Link
        href={editorHref}
        onClick={(event) => event.stopPropagation()}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <PencilSquareIcon className="h-4 w-4" />
      </Link>
    </Tooltip>
  ) : null;

  return (
    <PreviewCard
      title={displayLabel}
      description={item.description}
      showDescription={showDescription}
      preview={
        <OutputPreview groupKey={groupKey} preview={preview} className="h-full w-full" />
      }
      actions={footerActions}
      meta={footerMeta}
      overlayTopLeft={
        <span className="inline-flex items-center rounded-md bg-background/90 px-2 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm">
          {isImage ? "Image" : isCode ? "Code" : "Document"}
        </span>
      }
      overlayTopRight={
        isHtml && editorHref ? (
          <Tooltip content="Open in AI Editor" position="top">
            <Link
              href={editorHref}
              onClick={(event) => event.stopPropagation()}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-900/80 text-white shadow-lg transition-colors hover:bg-gray-900"
              aria-label="Open in AI Editor"
            >
              <PencilSquareIcon className="h-5 w-5" />
            </Link>
          </Tooltip>
        ) : null
      }
      onClick={() => onPreview(item)}
      className="group flex w-full flex-col text-left"
      previewClassName="aspect-[4/3] bg-muted/60"
    />
  );
}
