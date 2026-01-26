"use client";

import React from "react";
import { FullScreenPreviewModal } from "@/components/ui/FullScreenPreviewModal";
import { StreamHeader } from "./stream-viewer/StreamHeader";
import { StreamTerminal } from "./stream-viewer/StreamTerminal";
import { StreamPreview } from "./stream-viewer/StreamPreview";
import { useStreamViewer } from "./stream-viewer/useStreamViewer";
import { LogEntry } from "./stream-viewer/utils";

export type { LogEntry };

export interface StreamViewerUIProps {
  logs: LogEntry[];
  screenshotUrl?: string | null;
  screenshotBase64?: string | null;
  hasComputerUse?: boolean;
  status: "connecting" | "streaming" | "completed" | "error" | "pending";
  error?: string | null;
  onClearLogs?: () => void;
  headerContent?: React.ReactNode;
  className?: string;
}

export function StreamViewerUI({
  logs,
  screenshotUrl,
  screenshotBase64,
  hasComputerUse = false,
  status,
  error,
  onClearLogs,
  headerContent,
  className,
}: StreamViewerUIProps) {
  const {
    viewMode,
    setViewMode,
    isMaximized,
    setIsMaximized,
    isPreviewOpen,
    setIsPreviewOpen,
    searchQuery,
    setSearchQuery,
    currentMatchIndex,
    filterLevel,
    showLineNumbers,
    showTimestamps,
    wrapLines,
    expandedLogs,
    toggleExpandLog,
    scrollRef,
    matchRefs,
    filteredLogs,
    matchingIndices,
    navigateMatch,
    handleScroll,
    hasScreenshot,
    currentScreenshotSrc,
    showHtmlPreview,
    htmlSrcDoc,
    previewLabel,
    previewObjectUrl,
    previewFileName,
    previewContentType,
  } = useStreamViewer({
    logs,
    screenshotUrl,
    screenshotBase64,
    hasComputerUse,
  });

  const containerClasses = isMaximized
    ? "fixed inset-4 z-50 flex flex-col bg-white dark:bg-gray-950 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in duration-200"
    : `flex flex-col bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 h-[650px] shadow-sm overflow-hidden transition-all duration-200 ${className || ''}`;

  return (
    <>
      <div className={containerClasses}>
        {headerContent && (
          <StreamHeader
            status={status}
            logs={logs}
            headerContent={headerContent}
            isMaximized={isMaximized}
            setIsMaximized={setIsMaximized}
          />
        )}

        <div className="flex flex-1 overflow-hidden relative">
          <StreamTerminal
            viewMode={viewMode}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            matchingIndices={matchingIndices}
            currentMatchIndex={currentMatchIndex}
            navigateMatch={navigateMatch}
            scrollRef={scrollRef}
            handleScroll={handleScroll}
            filteredLogs={filteredLogs}
            logs={logs}
            searchQueryTrimmed={!!searchQuery.trim()}
            filterLevel={filterLevel}
            error={error}
            showLineNumbers={showLineNumbers}
            showTimestamps={showTimestamps}
            wrapLines={wrapLines}
            expandedLogs={expandedLogs}
            toggleExpandLog={toggleExpandLog}
            matchRefs={matchRefs}
          />

          <StreamPreview
            viewMode={viewMode}
            setViewMode={setViewMode}
            previewLabel={previewLabel}
            previewObjectUrl={previewObjectUrl}
            previewFileName={previewFileName}
            setIsPreviewOpen={setIsPreviewOpen}
            showHtmlPreview={showHtmlPreview}
            htmlSrcDoc={htmlSrcDoc}
            hasScreenshot={hasScreenshot}
            currentScreenshotSrc={currentScreenshotSrc}
            hasComputerUse={hasComputerUse}
          />
        </div>
      </div>

      {/* Backdrop for Maximized Mode */}
      {isMaximized && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200"
          onClick={() => setIsMaximized(false)}
        />
      )}

      {/* Full Screen Preview */}
      <FullScreenPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        objectUrl={previewObjectUrl || undefined}
        fileName={previewFileName}
        contentType={previewContentType}
      />
    </>
  );
}
