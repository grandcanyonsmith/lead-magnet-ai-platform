import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { FiFile, FiFileText } from "react-icons/fi";
import { api } from "@/lib/api";
import {
  detectContentTypeFromExtension,
  normalizeContentType,
  normalizePreviewUrl,
  extractHtmlFromCodeBlocks,
  shouldRewriteEditorOverlayApiUrl,
  getLocalApiUrlFallback,
  rewriteLeadMagnetEditorOverlayApiUrl,
  stripInjectedLeadMagnetScripts,
  convertJsonToMarkdown,
} from "./preview/utils";
import { ImagePreview } from "./preview/ImagePreview";
import { MarkdownPreview } from "./preview/MarkdownPreview";
import { HtmlPreview } from "./preview/HtmlPreview";
import { JsonPreview } from "./preview/JsonPreview";
import { PdfPreview } from "./preview/PdfPreview";

interface PreviewRendererProps {
  contentType?: string;
  objectUrl?: string;
  fileName?: string;
  className?: string;
  artifactId?: string;
  jobId?: string;
  autoUploadKey?: string;
  isFullScreen?: boolean;
  previewVariant?: "default" | "compact";
  viewMode?: "desktop" | "tablet" | "mobile";
  onViewModeChange?: (mode: "desktop" | "tablet" | "mobile") => void;
}

export function PreviewRenderer({
  contentType,
  objectUrl,
  fileName,
  className = "",
  artifactId,
  jobId,
  autoUploadKey,
  isFullScreen = false,
  previewVariant = "default",
  viewMode,
  onViewModeChange,
}: PreviewRendererProps) {
  const [isInView, setIsInView] = useState(false);
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [markdownError, setMarkdownError] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [htmlError, setHtmlError] = useState(false);
  const [jsonContent, setJsonContent] = useState<any>(null);
  const [jsonRaw, setJsonRaw] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState(false);
  const [jsonViewMode, setJsonViewMode] = useState<"markdown" | "json">(
    "json",
  );
  const [stableObjectUrl, setStableObjectUrl] = useState(objectUrl);
  const containerRef = useRef<HTMLDivElement>(null);
  const isCompactPreview = previewVariant === "compact" && !isFullScreen;

  const hasLoadError = htmlError || markdownError || jsonError;
  const objectUrlKey = useMemo(
    () => normalizePreviewUrl(objectUrl),
    [objectUrl],
  );
  const stableObjectUrlKey = useMemo(
    () => normalizePreviewUrl(stableObjectUrl),
    [stableObjectUrl],
  );
  const previewObjectUrl = stableObjectUrl ?? objectUrl;

  useEffect(() => {
    if (!objectUrl) {
      setStableObjectUrl(undefined);
      return;
    }
    if (!stableObjectUrl) {
      setStableObjectUrl(objectUrl);
      return;
    }

    const keysDiffer =
      objectUrlKey && stableObjectUrlKey && objectUrlKey !== stableObjectUrlKey;

    if (keysDiffer || (hasLoadError && objectUrl !== stableObjectUrl)) {
      setStableObjectUrl(objectUrl);
    }
  }, [
    objectUrl,
    objectUrlKey,
    stableObjectUrl,
    stableObjectUrlKey,
    hasLoadError,
  ]);

  // Determine effective content type with fallback to file extension
  const normalizedContentType = normalizeContentType(contentType);
  const extensionContentType = detectContentTypeFromExtension(fileName);
  const effectiveContentType =
    (normalizedContentType &&
    normalizedContentType !== "application/octet-stream"
      ? normalizedContentType
      : extensionContentType || normalizedContentType) ||
    "application/octet-stream";
  const isMarkdownLike =
    effectiveContentType === "text/markdown" ||
    effectiveContentType === "text/plain";
  const shouldAttemptJsonFromMarkdown = effectiveContentType === "text/plain";

  useEffect(() => {
    if (!isInView) return;
    const hasS3Url = Boolean(previewObjectUrl?.includes("amazonaws.com"));
    const shouldLog = Boolean(autoUploadKey) || hasS3Url;
    if (!shouldLog) return;
  }, [
    isInView,
    artifactId,
    jobId,
    autoUploadKey,
    previewObjectUrl,
    contentType,
    effectiveContentType,
    isMarkdownLike,
    fileName,
  ]);

  const fetchTextContent = useCallback(async (): Promise<string> => {
    const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Fetch timed out")), ms),
        ),
      ]);
    };

    if (artifactId) {
      return await withTimeout(api.artifacts.getArtifactContent(artifactId), 30000);
    }
    if (jobId && autoUploadKey) {
      return await withTimeout(
        api.jobs.getJobAutoUploadContent(jobId, autoUploadKey),
        30000,
      );
    }
    if (previewObjectUrl) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(previewObjectUrl, {
          signal: controller.signal,
          redirect: "error",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const text = await res.text();
        if (text.includes("<html") && text.includes("login")) {
          throw new Error("Received login page instead of content");
        }
        return text;
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error("No artifact ID or URL provided");
  }, [artifactId, autoUploadKey, jobId, previewObjectUrl]);

  useEffect(() => {
    if (isCompactPreview) {
      setIsInView(true);
      return;
    }

    const el = containerRef.current;
    if (!el) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.01, rootMargin: "200px" },
    );

    observer.observe(el);

    const fallbackTimer = setTimeout(() => {
      setIsInView((prev) => {
        if (!prev) observer.disconnect();
        return true;
      });
    }, 2000);

    return () => {
      observer.disconnect();
      clearTimeout(fallbackTimer);
    };
  }, [isCompactPreview]);

  // Reset error state when preview source changes (switching to different artifact)
  useEffect(() => {
    if (previewObjectUrl || artifactId || (jobId && autoUploadKey)) {
      setMarkdownError(false);
      setMarkdownContent(null);
      setHtmlError(false);
      setHtmlContent(null);
      setJsonError(false);
      setJsonContent(null);
      setJsonRaw(null);
      setJsonViewMode("json");
    }
  }, [previewObjectUrl, artifactId, jobId, autoUploadKey]);

  // Fetch markdown content when in view
  useEffect(() => {
    if (
      isInView &&
      isMarkdownLike &&
      markdownContent === null &&
      !markdownError
    ) {
      const fetchMarkdown = async () => {
        try {
          const text = await fetchTextContent();
          setMarkdownContent(text);
          setMarkdownError(false);
        } catch (err: any) {
          console.error("[PreviewRenderer] Failed to fetch markdown:", err);
          const msg = err?.message || "";
          if (msg.includes("404") || msg.includes("not found")) {
            setMarkdownContent(
              "**Artifact file not available**\n\nThe artifact file was not found in storage. It may have been deleted or not yet generated.",
            );
          } else {
            setMarkdownContent(
              `**Failed to load preview**\n\n${msg || "Unable to fetch artifact content. The file may require authentication or is temporarily unavailable."}`,
            );
          }
          setMarkdownError(false);
        }
      };
      fetchMarkdown();
    }
  }, [
    isInView,
    isMarkdownLike,
    previewObjectUrl,
    artifactId,
    markdownContent,
    markdownError,
    fetchTextContent,
    jobId,
    autoUploadKey,
  ]);

  // Fetch HTML content when in view
  useEffect(() => {
    if (
      isInView &&
      (effectiveContentType === "text/html" ||
        effectiveContentType === "application/xhtml+xml") &&
      htmlContent === null &&
      !htmlError
    ) {
      const fetchHtml = async () => {
        try {
          const text = await fetchTextContent();
          let extractedHtml = extractHtmlFromCodeBlocks(text);

          if (shouldRewriteEditorOverlayApiUrl()) {
            const localApiUrl =
              process.env.NEXT_PUBLIC_API_URL?.trim() ||
              getLocalApiUrlFallback();
            extractedHtml = rewriteLeadMagnetEditorOverlayApiUrl(
              extractedHtml,
              localApiUrl,
            );
          }

          const cleanedHtml = stripInjectedLeadMagnetScripts(extractedHtml).trim();
          setHtmlContent(
            cleanedHtml ||
              "<html><body><h1>Preview unavailable</h1><p>This HTML file was empty after preprocessing.</p></body></html>",
          );
          setHtmlError(false);
        } catch (err: any) {
          console.error("[PreviewRenderer] Failed to fetch HTML:", err);
          const msg = err?.message || "";
          if (msg.includes("404") || msg.includes("not found")) {
            setHtmlContent(
              "<html><body><h1>Artifact file not available</h1><p>The artifact file was not found in storage. It may have been deleted or not yet generated.</p></body></html>",
            );
            setHtmlError(false);
          } else {
            setHtmlContent(
              `<html><body><h1>Failed to load preview</h1><p>${msg || "Unable to fetch artifact content. The file may require authentication or is temporarily unavailable."}</p></body></html>`,
            );
            setHtmlError(false);
          }
        }
      };
      fetchHtml();
    }
  }, [
    isInView,
    effectiveContentType,
    previewObjectUrl,
    artifactId,
    htmlContent,
    htmlError,
    fetchTextContent,
    jobId,
    autoUploadKey,
  ]);

  // Fetch JSON content when in view
  useEffect(() => {
    if (
      isInView &&
      effectiveContentType === "application/json" &&
      jsonContent === null &&
      !jsonError
    ) {
      const fetchJson = async () => {
        try {
          const text = await fetchTextContent();

          try {
            const parsed = JSON.parse(text);
            setJsonContent(parsed);
            setJsonRaw(text);
            setJsonError(false);
          } catch (e) {
            // Failed to parse JSON
            console.error("Failed to parse JSON artifact:", e);
            setJsonRaw(text);
            setJsonError(true);
          }
        } catch (err: any) {
          console.error("[PreviewRenderer] Failed to fetch JSON:", err);
          const msg = err?.message || "";
          const errorPayload = msg.includes("404") || msg.includes("not found")
            ? { error: "Artifact file not available", message: "The artifact file was not found in storage." }
            : { error: "Failed to load preview", message: msg || "Unable to fetch artifact content." };
          setJsonContent(errorPayload);
          setJsonRaw(JSON.stringify(errorPayload, null, 2));
          setJsonError(false);
        }
      };
      fetchJson();
    }
  }, [
    isInView,
    effectiveContentType,
    previewObjectUrl,
    artifactId,
    jsonContent,
    jsonRaw,
    jsonError,
    fetchTextContent,
  ]);

  // Attempt to parse markdown content as JSON if it looks like one
  const parsedMarkdownJson = useMemo(() => {
    if (markdownContent === null || !shouldAttemptJsonFromMarkdown) return null;
    try {
      const trimmed = markdownContent.trim();
      // Check if it looks like JSON before parsing
      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        return JSON.parse(trimmed);
      }
      // Also handle code blocks
      const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
      if (match && match[1]) {
        const inner = match[1].trim();
        if (
          (inner.startsWith("{") && inner.endsWith("}")) ||
          (inner.startsWith("[") && inner.endsWith("]"))
        ) {
          return JSON.parse(inner);
        }
      }
    } catch (e) {
      return null;
    }
    return null;
  }, [markdownContent, shouldAttemptJsonFromMarkdown]);

  const jsonMarkdown = useMemo(() => {
    if (jsonError) return null;
    if (jsonContent === null && jsonRaw === null) return null;
    const value = jsonContent ?? jsonRaw;
    return convertJsonToMarkdown(value);
  }, [jsonContent, jsonRaw, jsonError]);

  const parsedMarkdownJsonMarkdown = useMemo(() => {
    if (!parsedMarkdownJson) return null;
    return convertJsonToMarkdown(parsedMarkdownJson);
  }, [parsedMarkdownJson]);

  const jsonMarkdownPreview = jsonMarkdown ?? parsedMarkdownJsonMarkdown;
  // Compact cards do not render the JSON/summary toggle, so prefer the summary view
  // whenever we can synthesize one from JSON content.
  const resolvedJsonViewMode = jsonMarkdownPreview
    ? isCompactPreview
      ? "markdown"
      : jsonViewMode
    : "json";

  if (!previewObjectUrl && !artifactId) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${className}`}
      >
        <FiFile className="w-12 h-12 text-gray-400 dark:text-gray-500" />
      </div>
    );
  }

  const renderPreview = () => {
    if (effectiveContentType.startsWith("image/")) {
      return (
        <ImagePreview
          isFullScreen={isFullScreen}
          previewObjectUrl={previewObjectUrl}
          fileName={fileName}
          isInView={isInView}
        />
      );
    }

    if (effectiveContentType === "application/pdf") {
      return (
        <PdfPreview
          previewObjectUrl={previewObjectUrl}
          fileName={fileName}
          isInView={isInView}
        />
      );
    }

    if (
      effectiveContentType === "text/html" ||
      effectiveContentType === "application/xhtml+xml"
    ) {
      return (
        <HtmlPreview
          isFullScreen={isFullScreen}
          isCompactPreview={isCompactPreview}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          fileName={fileName}
          isInView={isInView}
          htmlContent={htmlContent}
          htmlError={htmlError}
        />
      );
    }

    if (effectiveContentType === "application/json") {
      return (
        <JsonPreview
          isFullScreen={isFullScreen}
          isCompactPreview={isCompactPreview}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          fileName={fileName}
          isInView={isInView}
          jsonContent={jsonContent}
          jsonRaw={jsonRaw}
          jsonError={jsonError}
          jsonMarkdownPreview={jsonMarkdownPreview}
          resolvedJsonViewMode={resolvedJsonViewMode}
          setJsonViewMode={setJsonViewMode}
        />
      );
    }

    if (isMarkdownLike) {
      return (
        <MarkdownPreview
          isFullScreen={isFullScreen}
          isCompactPreview={isCompactPreview}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          fileName={fileName}
          isInView={isInView}
          markdownContent={markdownContent}
          markdownError={markdownError}
          parsedMarkdownJson={parsedMarkdownJson}
          parsedMarkdownJsonMarkdown={parsedMarkdownJsonMarkdown}
          resolvedJsonViewMode={resolvedJsonViewMode}
          setJsonViewMode={setJsonViewMode}
        />
      );
    }

    if (effectiveContentType.startsWith("text/")) {
      return (
        <div className="flex items-center justify-center bg-gray-50 dark:bg-gray-900 h-full">
          <div className="text-center">
            <FiFileText className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Text File
            </p>
          </div>
        </div>
      );
    }

    const icon = effectiveContentType.startsWith("video/")
      ? FiFile
      : effectiveContentType.startsWith("audio/")
        ? FiFile
        : FiFile;

    return (
      <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 h-full">
        {icon === FiFile ? (
          <FiFile className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        ) : null}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden ${className}`}
      style={{
        minHeight: "100px",
        height: "100%",
        width: "100%",
      }}
    >
      {renderPreview()}
    </div>
  );
}
