"use client";

import React, { Fragment, useEffect, useCallback, useState } from "react";
import {
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowTopRightOnSquareIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
} from "@heroicons/react/24/outline";
import { PreviewRenderer } from "@/components/artifacts/PreviewRenderer";
import { toast } from "react-hot-toast";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";

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
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={onClose}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/95 backdrop-blur-sm" />
          </TransitionChild>

          <div className="fixed inset-0">
            <DialogPanel className="relative flex h-full w-full flex-col overflow-hidden">
        {/* Navigation Buttons */}
        {hasPrevious && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrevious?.();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white backdrop-blur-md transition-all hover:bg-white/20 hover:scale-110 active:scale-95 z-50"
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
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white backdrop-blur-md transition-all hover:bg-white/20 hover:scale-110 active:scale-95 z-50"
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
          <div className="flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-6 py-4">
            <div className="flex flex-col min-w-0">
              <DialogTitle className="text-lg font-semibold text-white truncate max-w-xl">
                {fileName || "Preview"}
              </DialogTitle>
              {contentType && (
                <p className="text-xs text-white/60 font-mono">{contentType}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex items-center justify-center min-h-0 p-2 sm:p-8 overflow-hidden">
            <div
              className={`relative flex justify-center ${
                isHtml || isImage ? "items-center" : "items-start"
              } ${
                isHtml || isMarkdown
                  ? "h-full w-full bg-white rounded-lg overflow-hidden"
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
                      ? "max-h-full max-w-full object-contain shadow-2xl rounded-lg"
                      : "w-full h-auto min-h-full bg-white rounded-lg p-6 sm:p-12 shadow-xl text-gray-900 mb-20"
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
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
            <div className="flex items-center gap-1 rounded-2xl bg-gray-900/90 p-2 text-white shadow-xl backdrop-blur-md ring-1 ring-white/10">
              {isImage && (
                <>
                  <div className="flex items-center border-r border-white/10 px-2">
                    <button
                      onClick={handleZoomOut}
                      className="p-2 hover:text-primary-400 transition-colors rounded-lg hover:bg-white/5"
                      title="Zoom Out"
                    >
                      <MagnifyingGlassMinusIcon className="h-5 w-5" />
                    </button>
                    <span className="min-w-[3rem] text-center text-xs font-medium tabular-nums">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button
                      onClick={handleZoomIn}
                      className="p-2 hover:text-primary-400 transition-colors rounded-lg hover:bg-white/5"
                      title="Zoom In"
                    >
                      <MagnifyingGlassPlusIcon className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="h-6 w-px bg-white/10 mx-1" />
                </>
              )}

              {objectUrl && (
                <>
                  <button
                    onClick={() => window.open(objectUrl, "_blank")}
                    className="p-2 hover:text-primary-400 transition-colors rounded-lg hover:bg-white/5"
                    title="Open in new tab"
                  >
                    <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={handleCopy}
                    className="p-2 hover:text-primary-400 transition-colors rounded-lg hover:bg-white/5"
                    title="Copy Link"
                  >
                    <ClipboardDocumentIcon className="h-5 w-5" />
                  </button>
                  <a
                    href={objectUrl}
                    download={fileName || "download"}
                    className="p-2 hover:text-primary-400 transition-colors rounded-lg hover:bg-white/5"
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
            </DialogPanel>
          </div>
        </Dialog>
      </Transition>
    );
  },
);
