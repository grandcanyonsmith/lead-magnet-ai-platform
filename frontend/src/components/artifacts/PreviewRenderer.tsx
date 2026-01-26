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
    "markdown",
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
    if (artifactId) {
      return await api.artifacts.getArtifactContent(artifactId);
    }
    if (jobId && autoUploadKey) {
      return await api.jobs.getJobAutoUploadContent(jobId, autoUploadKey);
    }
    if (previewObjectUrl) {
      const res = await fetch(previewObjectUrl);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.text();
    }
    throw new Error("No artifact ID or URL provided");
  }, [artifactId, autoUploadKey, jobId, previewObjectUrl]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          // Once in view, we can disconnect to prevent re-triggering
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "50px" },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

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
      setJsonViewMode("markdown");
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
          setMarkdownError(false); // Clear any previous error on success
        } catch (err: any) {
          if (process.env.NODE_ENV === "development") {
            console.error("Failed to fetch markdown:", err);
          }
          // If artifact not found, show a helpful message instead of error state
          if (
            err?.message?.includes("404") ||
            err?.message?.includes("not found")
          ) {
            setMarkdownContent(
              "**Artifact file not available**\n\nThe artifact file was not found in storage. It may have been deleted or not yet generated.",
            );
            setMarkdownError(false);
          } else {
            setMarkdownError(true);
          }
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
          // Extract HTML from markdown code blocks if present
          let extractedHtml = extractHtmlFromCodeBlocks(text);

          // Local dev: artifacts may contain an injected editor overlay pointing at the production API.
          // When previewing inside the local dashboard, rewrite it to use the local API so
          // "Preview AI patch" works without hitting API Gateway.
          if (shouldRewriteEditorOverlayApiUrl()) {
            const localApiUrl =
              process.env.NEXT_PUBLIC_API_URL?.trim() ||
              getLocalApiUrlFallback();
            extractedHtml = rewriteLeadMagnetEditorOverlayApiUrl(
              extractedHtml,
              localApiUrl,
            );
          }

          // Strip injected overlay/tracking scripts for in-dashboard preview to avoid sandbox issues.
          setHtmlContent(stripInjectedLeadMagnetScripts(extractedHtml));
          setHtmlError(false); // Clear any previous error on success
        } catch (err: any) {
          if (process.env.NODE_ENV === "development") {
            console.error("Failed to fetch HTML:", err);
          }
          // If artifact not found, show a helpful message instead of error state
          if (
            err?.message?.includes("404") ||
            err?.message?.includes("not found")
          ) {
            setHtmlContent(
              "<html><body><h1>Artifact file not available</h1><p>The artifact file was not found in storage. It may have been deleted or not yet generated.</p></body></html>",
            );
            setHtmlError(false);
          } else {
            setHtmlError(true);
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
          if (process.env.NODE_ENV === "development") {
            console.error("Failed to fetch JSON:", err);
          }
          if (
            err?.message?.includes("404") ||
            err?.message?.includes("not found")
          ) {
            setJsonContent({ error: "Artifact file not available" });
            setJsonRaw(
              JSON.stringify(
                {
                  error: "Artifact file not available",
                  message:
                    "The artifact file was not found in storage. It may have been deleted or not yet generated.",
                },
                null,
                2,
              ),
            );
            setJsonError(false);
          } else {
            setJsonError(true);
          }
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
    if (markdownContent === null || !isMarkdownLike) return null;
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
  }, [markdownContent, isMarkdownLike]);

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
  const resolvedJsonViewMode = jsonMarkdownPreview ? jsonViewMode : "json";

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
        contentVisibility: "auto",
        minHeight: "0",
        height: "100%",
        width: "100%",
      }}
    >
      {renderPreview()}
    </div>
  );
}
