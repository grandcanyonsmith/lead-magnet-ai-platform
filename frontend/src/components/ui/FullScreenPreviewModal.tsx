"use client";

import React, { useEffect, useCallback, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowTopRightOnSquareIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
} from "@heroicons/react/24/outline";
import { PreviewRenderer } from "@/components/artifacts/PreviewRenderer";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/Dialog";

interface FullScreenPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentType?: string;
  objectUrl?: string;
  fileName?: string;
  artifactId?: string;
  jobId?: string;
  autoUploadKey?: string;
  // Navigation
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

type ViewMode = "desktop" | "tablet" | "mobile";

const isHtmlPreview = (contentType?: string, fileNameLower = ""): boolean => {
  const normalizedType = (contentType || "").toLowerCase();
  return (
    normalizedType.startsWith("text/html") ||
    normalizedType === "application/xhtml+xml" ||
    fileNameLower.endsWith(".html") ||
    fileNameLower.endsWith(".htm")
  );
};

const getDefaultViewMode = (contentType?: string, fileName?: string): ViewMode =>
  isHtmlPreview(contentType, (fileName || "").toLowerCase())
    ? "mobile"
    : "desktop";

export const FullScreenPreviewModal = React.memo(
  function FullScreenPreviewModal({
    isOpen,
    onClose,
    contentType,
    objectUrl,
    fileName,
    artifactId,
    jobId,
    autoUploadKey,
    onNext,
    onPrevious,
    hasNext,
    hasPrevious,
  }: FullScreenPreviewModalProps) {
    const [viewMode, setViewMode] = useState<ViewMode>(() =>
      getDefaultViewMode(contentType, fileName),
    );
    const [zoom, setZoom] = useState(1);

    // Reset state when content changes
    useEffect(() => {
      if (isOpen) {
        setViewMode(getDefaultViewMode(contentType, fileName));
        setZoom(1);
      }
    }, [isOpen, objectUrl, contentType, fileName]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if (!isOpen) return;

        if (e.key === "ArrowRight" && hasNext && onNext) {
          onNext();
        } else if (e.key === "ArrowLeft" && hasPrevious && onPrevious) {
          onPrevious();
        }
      },
      [isOpen, hasNext, onNext, hasPrevious, onPrevious],
    );

    useEffect(() => {
      if (isOpen) {
        document.addEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "hidden";
      }

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        if (isOpen) {
          document.body.style.overflow = "unset";
        }
      };
    }, [isOpen, handleKeyDown]);

    const handleCopy = async () => {
      if (!objectUrl) return;
      try {
        await navigator.clipboard.writeText(objectUrl);
        toast.success("Link copied to clipboard");
      } catch {
        toast.error("Failed to copy link");
      }
    };

    const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
    const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));

    const fileNameLower = (fileName || "").toLowerCase();
    const contentTypeLower = (contentType || "").toLowerCase();
    const isHtml = isHtmlPreview(contentType, fileNameLower);
    const isJson =
      contentTypeLower.includes("application/json") || fileNameLower.endsWith(".json");
    const isMarkdown =
      contentTypeLower.startsWith("text/markdown") ||
      fileNameLower.endsWith(".md") ||
      fileNameLower.endsWith(".markdown") ||
      isJson;
    const isImage = contentType?.startsWith("image/");

    return (
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent className="fixed inset-0 left-0 top-0 z-[9999] flex h-[100dvh] max-h-none w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 sm:rounded-none">
          <div className="relative flex h-full w-full flex-col overflow-hidden">
            {/* Navigation Buttons */}
            {hasPrevious && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPrevious?.();
                }}
                className="absolute left-4 top-1/2 z-50 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white backdrop-blur-md transition-all hover:scale-110 hover:bg-white/20 active:scale-95"
                aria-label="Previous item"
              >
                <ChevronLeftIcon className="h-8 w-8" />
              </button>
            )}

            {hasNext && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNext?.();
                }}
                className="absolute right-4 top-1/2 z-50 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white backdrop-blur-md transition-all hover:scale-110 hover:bg-white/20 active:scale-95"
                aria-label="Next item"
              >
                <ChevronRightIcon className="h-8 w-8" />
              </button>
            )}

            {/* Main Container */}
            <div
              className="relative flex h-full w-full flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-b from-black/80 to-transparent px-6 py-4 pr-14">
                <div className="flex min-w-0 flex-col">
                  <DialogTitle className="max-w-xl truncate text-lg font-semibold text-white">
                    {fileName || "Preview"}
                  </DialogTitle>
                  {contentType && (
                    <p className="font-mono text-xs text-white/60">{contentType}</p>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2 sm:p-8">
                <div
                  className={`relative flex justify-center ${
                    isHtml || isImage ? "items-center" : "items-start"
                  } ${
                    isHtml || isMarkdown
                      ? "h-full w-full overflow-hidden rounded-lg bg-white"
                      : isImage
                        ? "h-full w-full overflow-hidden"
                        : "h-full w-full overflow-y-auto pt-4 sm:pt-0"
                  }`}
                  style={
                    isImage
                      ? {
                          transform: `scale(${zoom})`,
                          transition: "transform 0.2s ease-out",
                        }
                      : undefined
                  }
                >
                  <PreviewRenderer
                    contentType={contentType}
                    objectUrl={objectUrl}
                    fileName={fileName}
                    className={
                      isHtml || isMarkdown
                        ? "h-full w-full"
                        : isImage
                          ? "max-h-full max-w-full rounded-lg object-contain shadow-2xl"
                          : "mb-20 min-h-full w-full rounded-lg bg-white p-6 text-gray-900 shadow-xl sm:p-12"
                    }
                    artifactId={artifactId}
                    jobId={jobId}
                    autoUploadKey={autoUploadKey}
                    isFullScreen={true}
                    viewMode={isHtml || isMarkdown ? viewMode : undefined}
                    onViewModeChange={
                      isHtml || isMarkdown ? setViewMode : undefined
                    }
                  />
                </div>
              </div>

              {/* Floating Toolbar */}
              <div className="absolute bottom-8 left-1/2 z-50 -translate-x-1/2">
                <div className="flex items-center gap-1 rounded-2xl bg-gray-900/90 p-2 text-white shadow-xl ring-1 ring-white/10 backdrop-blur-md">
                  {isImage && (
                    <>
                      <div className="flex items-center border-r border-white/10 px-2">
                        <button
                          onClick={handleZoomOut}
                          className="rounded-lg p-2 transition-colors hover:bg-white/5 hover:text-primary-400"
                          title="Zoom Out"
                        >
                          <MagnifyingGlassMinusIcon className="h-5 w-5" />
                        </button>
                        <span className="min-w-[3rem] text-center text-xs font-medium tabular-nums">
                          {Math.round(zoom * 100)}%
                        </span>
                        <button
                          onClick={handleZoomIn}
                          className="rounded-lg p-2 transition-colors hover:bg-white/5 hover:text-primary-400"
                          title="Zoom In"
                        >
                          <MagnifyingGlassPlusIcon className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="mx-1 h-6 w-px bg-white/10" />
                    </>
                  )}

                  {objectUrl && (
                    <>
                      <button
                        onClick={() => window.open(objectUrl, "_blank")}
                        className="rounded-lg p-2 transition-colors hover:bg-white/5 hover:text-primary-400"
                        title="Open in new tab"
                      >
                        <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={handleCopy}
                        className="rounded-lg p-2 transition-colors hover:bg-white/5 hover:text-primary-400"
                        title="Copy Link"
                      >
                        <ClipboardDocumentIcon className="h-5 w-5" />
                      </button>
                      <a
                        href={objectUrl}
                        download={fileName || "download"}
                        className="rounded-lg p-2 transition-colors hover:bg-white/5 hover:text-primary-400"
                        title="Download"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ArrowDownTrayIcon className="h-5 w-5" />
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  },
);
