"use client";

import { useState } from "react";
import {
  ArrowDownTrayIcon,
  ArrowUpOnSquareIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { openJobDocumentInNewTab } from "@/utils/jobs/openJobDocument";
import { getOutputUrl, getOutputPreviewMeta, getOutputGroupKey } from "@/utils/jobs/outputs";
import { OutputPreview } from "@/components/jobs/detail/OutputPreview";
import type { ArtifactGalleryItem } from "@/types/job";

interface FinalDeliverableCardProps {
  item: ArtifactGalleryItem;
  onPreview: (item: ArtifactGalleryItem) => void;
}

export function FinalDeliverableCard({
  item,
  onPreview,
}: FinalDeliverableCardProps) {
  const [opening, setOpening] = useState(false);
  const artifactUrl = getOutputUrl(item);
  const groupKey = getOutputGroupKey(item);
  const preview = getOutputPreviewMeta(item);

  const handleViewOutput = async () => {
    if (!item.jobId || opening) return;
    setOpening(true);
    try {
      await openJobDocumentInNewTab(item.jobId);
    } finally {
      setOpening(false);
    }
  };

  const handleCopy = async () => {
    if (!artifactUrl) return;
    try {
      await navigator.clipboard.writeText(artifactUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Unable to copy link");
    }
  };

  return (
    <div
      className="rounded-xl bg-card shadow-[0_2px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_24px_rgba(0,0,0,0.2)] overflow-hidden cursor-pointer"
      onClick={() => onPreview(item)}
    >
      <div className="relative w-full aspect-[16/7] bg-muted/40 overflow-hidden">
        <OutputPreview groupKey={groupKey} preview={preview} className="h-full w-full" />
      </div>

      <div className="p-5 space-y-4">
        <p className="text-lg font-semibold text-foreground">
          {item.description || item.label || "Final Deliverable Hero Card"}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void handleViewOutput(); }}
            disabled={opening || !item.jobId}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {opening ? "Opening..." : "View Output"}
          </button>

          {artifactUrl && (
            <>
              <a
                href={artifactUrl}
                download
                onClick={(e) => e.stopPropagation()}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Download"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
              </a>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); void handleCopy(); }}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Share"
              >
                <ArrowUpOnSquareIcon className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
