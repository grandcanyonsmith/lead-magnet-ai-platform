import { useState, useEffect, useRef, useMemo } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import {
  FiFile,
  FiImage,
  FiFileText,
  FiCode,
  FiMonitor,
  FiTablet,
  FiSmartphone,
} from "react-icons/fi";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { api } from "@/lib/api";
import { JsonViewer } from "@/components/ui/JsonViewer";
import {
  ShellExecutorLogsPreview,
  isShellExecutorLogsPayload,
  type ShellExecutorLogsPayload,
} from "@/components/artifacts/ShellExecutorLogsPreview";
import {
  CodeExecutorLogsPreview,
  isCodeExecutorLogsPayload,
  type CodeExecutorLogsPayload,
} from "@/components/artifacts/CodeExecutorLogsPreview";

interface PreviewRendererProps {
  contentType?: string;
  objectUrl?: string;
  fileName?: string;
  className?: string;
  artifactId?: string;
  isFullScreen?: boolean;
  previewVariant?: "default" | "compact";
  viewMode?: "desktop" | "tablet" | "mobile";
  onViewModeChange?: (mode: "desktop" | "tablet" | "mobile") => void;
}

/**
 * Detect content type from file extension as fallback
 */
function detectContentTypeFromExtension(fileName?: string): string | null {
  if (!fileName) return null;
  const ext = fileName.split(".").pop()?.toLowerCase();
  const typeMap: Record<string, string> = {
    html: "text/html",
    htm: "text/html",
    md: "text/markdown",
    markdown: "text/markdown",
    txt: "text/plain",
    json: "application/json",
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
  };
  return typeMap[ext || ""] || null;
}

function normalizePreviewUrl(url?: string | null): string | null {
  const raw = (url || "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return raw.split("?")[0].split("#")[0];
  }
}

/**
 * Extract HTML content from markdown code blocks
 * Handles both ```html and ``` markers
 */
function extractHtmlFromCodeBlocks(text: string): string {
  const trimmed = text.trim();

  // Check for ```html code block
  if (trimmed.startsWith("```html")) {
    const match = trimmed.match(/^```html\s*([\s\S]*?)\s*```$/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Check for generic ``` code block
  if (trimmed.startsWith("```")) {
    const match = trimmed.match(/^```\s*([\s\S]*?)\s*```$/);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Return original text if no code blocks found
  return text;
}

function shouldRewriteEditorOverlayApiUrl(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

function getLocalApiUrlFallback(): string {
  if (typeof window === "undefined") return "http://localhost:3001";
  try {
    const origin = window.location.origin || "http://localhost:3000";
    // If the dashboard is running on :3000, the local API is typically :3001.
    return origin.replace(/:\d+$/, ":3001");
  } catch {
    return "http://localhost:3001";
  }
}

function rewriteLeadMagnetEditorOverlayApiUrl(
  html: string,
  apiUrl: string,
): string {
  if (!html || !html.includes("Lead Magnet Editor Overlay")) return html;

  // Only rewrite the apiUrl inside the injected CFG block.
  // Example:
  // const CFG = {
  //   jobId: "...",
  //   tenantId: "...",
  //   apiUrl: "https://...",
  // };
  return html.replace(
    /(const CFG = \{\s*[\s\S]*?apiUrl:\s*)"[^"]*"/,
    `$1"${apiUrl}"`,
  );
}

function stripInjectedLeadMagnetScripts(html: string): string {
  return String(html || "")
    .replace(
      /<!--\s*Lead Magnet Editor Overlay\s*-->[\s\S]*?<\/script>\s*/gi,
      "",
    )
    .replace(
      /<!--\s*Lead Magnet Tracking Script\s*-->[\s\S]*?<\/script>\s*/gi,
      "",
    )
    .trim();
}

function extractJsonFromCodeBlock(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return trimmed;
}

function parseNestedJsonString(value: string, maxDepth = 2): unknown | null {
  let current: unknown = value;
  let parsedAtLeastOnce = false;

  for (let depth = 0; depth < maxDepth; depth += 1) {
    if (typeof current !== "string") break;
    const trimmed = extractJsonFromCodeBlock(current).trim();
    if (!trimmed) break;

    try {
      current = JSON.parse(trimmed);
      parsedAtLeastOnce = true;
    } catch {
      break;
    }
  }

  return parsedAtLeastOnce ? current : null;
}

function formatExecutorLogsContent(value: string): string {
  const parsed = parseNestedJsonString(value);
  if (parsed === null) return value;
  if (typeof parsed === "string") return parsed;
  try {
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

function tryParseShellExecutorLogsPayload(
  value: unknown,
): ShellExecutorLogsPayload | null {
  if (!value) return null;
  if (isShellExecutorLogsPayload(value)) return value;
  if (typeof value === "string") {
    const parsed = parseNestedJsonString(value);
    return parsed && isShellExecutorLogsPayload(parsed) ? parsed : null;
  }
  return null;
}

function tryParseCodeExecutorLogsPayload(
  value: unknown,
): CodeExecutorLogsPayload | null {
  if (!value) return null;
  if (isCodeExecutorLogsPayload(value)) return value;
  if (typeof value === "string") {
    const parsed = parseNestedJsonString(value);
    return parsed && isCodeExecutorLogsPayload(parsed) ? parsed : null;
  }
  return null;
}

function isExecutorLogsFileName(fileName?: string): boolean {
  const normalized = String(fileName || "")
    .toLowerCase()
    .replace(/\s+/g, "_");
  return (
    normalized.includes("shell_executor_logs") ||
    normalized.includes("code_executor_logs") ||
    normalized.includes("executor_logs")
  );
}

export function PreviewRenderer({
  contentType,
  objectUrl,
  fileName,
  className = "",
  artifactId,
  isFullScreen = false,
  previewVariant = "default",
  viewMode,
  onViewModeChange,
}: PreviewRendererProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [markdownError, setMarkdownError] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [htmlError, setHtmlError] = useState(false);
  const [jsonContent, setJsonContent] = useState<any>(null);
  const [jsonRaw, setJsonRaw] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState(false);
  const [stableObjectUrl, setStableObjectUrl] = useState(objectUrl);
  const containerRef = useRef<HTMLDivElement>(null);
  const isCompactPreview = previewVariant === "compact" && !isFullScreen;
  const compactHtmlScale = 0.5;
  const htmlViewModeClassName =
    viewMode === "tablet"
      ? "w-full max-w-[768px] mx-auto"
      : viewMode === "mobile"
        ? "w-full max-w-[375px] mx-auto"
        : "w-full";

  const hasLoadError = imageError || htmlError || markdownError || jsonError;
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
  }, [objectUrl, objectUrlKey, stableObjectUrl, stableObjectUrlKey, hasLoadError]);

  // Determine effective content type with fallback to file extension
  const effectiveContentType =
    contentType ||
    detectContentTypeFromExtension(fileName) ||
    "application/octet-stream";
  const isMarkdownLike =
    effectiveContentType === "text/markdown" ||
    effectiveContentType === "text/plain";

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold: 0.1 },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Reset error state when preview source changes (switching to different artifact)
  useEffect(() => {
    if (previewObjectUrl || artifactId) {
      setImageLoaded(false);
      setImageError(false);
      setMarkdownError(false);
      setMarkdownContent(null);
      setHtmlError(false);
      setHtmlContent(null);
      setJsonError(false);
      setJsonContent(null);
      setJsonRaw(null);
    }
  }, [previewObjectUrl, artifactId]);

  // Fetch markdown content when in view
  useEffect(() => {
    if (
      isInView &&
      isMarkdownLike &&
      !markdownContent &&
      !markdownError
    ) {
      // Use API endpoint if artifactId is available, otherwise fall back to direct URL
      const fetchMarkdown = async () => {
        try {
          let text: string;
          if (artifactId) {
            // Use API endpoint to proxy from S3 (avoids presigned URL expiration)
            text = await api.artifacts.getArtifactContent(artifactId);
          } else if (previewObjectUrl) {
            // Fallback to direct URL fetch
            const res = await fetch(previewObjectUrl);
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            text = await res.text();
          } else {
            throw new Error("No artifact ID or URL provided");
          }
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
  ]);

  // Fetch HTML content when in view
  useEffect(() => {
    if (
      isInView &&
      (effectiveContentType === "text/html" ||
        effectiveContentType === "application/xhtml+xml") &&
      !htmlContent &&
      !htmlError
    ) {
      // Use API endpoint if artifactId is available, otherwise fall back to direct URL
      const fetchHtml = async () => {
        try {
          let text: string;
          if (artifactId) {
            // Use API endpoint to proxy from S3 (avoids presigned URL expiration and CORS issues)
            text = await api.artifacts.getArtifactContent(artifactId);
          } else if (previewObjectUrl) {
            // Fallback to direct URL fetch
            const res = await fetch(previewObjectUrl);
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            text = await res.text();
          } else {
            throw new Error("No artifact ID or URL provided");
          }
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
  ]);

  // Fetch JSON content when in view
  useEffect(() => {
    if (
      isInView &&
      effectiveContentType === "application/json" &&
      !jsonContent &&
      !jsonError
    ) {
      const fetchJson = async () => {
        try {
          let text: string;
          if (artifactId) {
            text = await api.artifacts.getArtifactContent(artifactId);
          } else if (previewObjectUrl) {
            const res = await fetch(previewObjectUrl);
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            text = await res.text();
          } else {
            throw new Error("No artifact ID or URL provided");
          }

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
    jsonError,
  ]);

  // Attempt to parse markdown content as JSON if it looks like one
  const parsedMarkdownJson = useMemo(() => {
    if (!markdownContent || !isMarkdownLike) return null;
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

  if (!previewObjectUrl && !artifactId) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${className}`}
      >
        <FiFile className="w-12 h-12 text-gray-400 dark:text-gray-500" />
      </div>
    );
  }

  const CompactPreviewFrame = ({ children }: { children: ReactNode }) => (
    <div className="relative w-full h-full bg-gray-50 dark:bg-gray-900 p-2">
      <div className="h-full w-full overflow-hidden rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm">
        {children}
      </div>
    </div>
  );

  const CompactScaledContent = ({
    children,
    paddingClassName = "p-3",
    scale = 0.7,
    textClassName = "text-[10px] leading-snug",
  }: {
    children: ReactNode;
    paddingClassName?: string;
    scale?: number;
    textClassName?: string;
  }) => {
    const inverseScale = 100 / scale;

    return (
      <div
        className="origin-top-left"
        style={{
          transform: `scale(${scale})`,
          width: `${inverseScale}%`,
          height: `${inverseScale}%`,
        }}
      >
        <div className={`${paddingClassName} ${textClassName}`}>{children}</div>
      </div>
    );
  };

  const renderPreview = () => {
    if (effectiveContentType.startsWith("image/")) {
      if (isFullScreen) {
        // Full-screen mode: use regular img tag for better scaling
        return (
          <div className="relative flex items-center justify-center w-full h-full">
            {!imageLoaded && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <FiImage className="w-12 h-12 text-white/50 animate-pulse" />
              </div>
            )}
            {imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <FiImage className="w-12 h-12 text-white/50" />
              </div>
            )}
            {isInView && previewObjectUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewObjectUrl}
                alt={fileName || "Preview"}
                className={`max-w-[95vw] max-h-[95vh] object-contain ${imageLoaded ? "opacity-100" : "opacity-0"} transition-opacity`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                style={{ maxWidth: "95vw", maxHeight: "95vh" }}
              />
            )}
          </div>
        );
      }

      // Regular mode: use Next.js Image with fill
      return (
        <div className="relative w-full h-full flex items-center justify-center min-h-0">
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
              <FiImage className="w-12 h-12 text-gray-400 dark:text-gray-500 animate-pulse" />
            </div>
          )}
          {imageError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
              <FiImage className="w-12 h-12 text-gray-400 dark:text-gray-500" />
            </div>
          )}
          {isInView && previewObjectUrl && (
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <Image
                src={previewObjectUrl}
                alt={fileName || "Preview"}
                fill
                className={`object-contain ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                unoptimized
                sizes="(max-width: 768px) 100vw, 95vw"
              />
            </div>
          )}
        </div>
      );
    }

    if (effectiveContentType === "application/pdf") {
      return (
        <div className="relative w-full h-full bg-white dark:bg-gray-950">
          {isInView && previewObjectUrl ? (
            <iframe
              src={`${previewObjectUrl}#toolbar=0&navpanes=0&scrollbar=0`}
              className="w-full h-full border-0"
              title={fileName || "PDF Preview"}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800">
              <FiFileText className="w-12 h-12 text-red-400 dark:text-red-300" />
            </div>
          )}
        </div>
      );
    }

    if (
      effectiveContentType === "text/html" ||
      effectiveContentType === "application/xhtml+xml"
    ) {
      if (isFullScreen) {
        // Full-screen HTML rendering with view mode support
        return (
          <div className="relative w-full h-full bg-white dark:bg-gray-950 flex flex-col">
            {/* Header with view mode switcher */}
            {onViewModeChange && (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <div className="flex gap-2">
                  <button
                    onClick={() => onViewModeChange("desktop")}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === "desktop"
                        ? "bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                    aria-label="Desktop view"
                    title="Desktop view"
                  >
                    <FiMonitor className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onViewModeChange("tablet")}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === "tablet"
                        ? "bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                    aria-label="Tablet view"
                    title="Tablet view"
                  >
                    <FiTablet className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onViewModeChange("mobile")}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === "mobile"
                        ? "bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                    aria-label="Mobile view"
                    title="Mobile view"
                  >
                    <FiSmartphone className="w-5 h-5" />
                  </button>
                </div>
                {fileName && (
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-md">
                    {fileName}
                  </div>
                )}
              </div>
            )}

            {/* HTML content area */}
            <div className="flex-1 min-h-0">
              {isInView ? (
                htmlError ? (
                  <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                    <div className="text-center">
                      <FiCode className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Failed to load HTML
                      </p>
                    </div>
                  </div>
                ) : htmlContent ? (
                  <div
                    className={`bg-white dark:bg-gray-950 transition-all duration-300 h-full ${
                      viewMode === "tablet"
                        ? "w-[768px] max-w-[768px] mx-auto"
                        : viewMode === "mobile"
                          ? "w-[375px] max-w-[375px] mx-auto"
                          : "w-full"
                    }`}
                  >
                    <iframe
                      srcDoc={htmlContent}
                      className="w-full h-full border-0"
                      title={fileName || "HTML Preview"}
                      sandbox="allow-scripts allow-forms allow-popups"
                      referrerPolicy="no-referrer"
                      style={{ display: "block", height: "100%" }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full bg-black">
                    <div className="text-center">
                      <FiCode className="w-12 h-12 text-white/50 mx-auto mb-2 animate-pulse" />
                      <p className="text-xs text-white/70">Loading HTML...</p>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center h-full bg-black">
                  <FiCode className="w-12 h-12 text-white/50" />
                </div>
              )}
            </div>
          </div>
        );
      }

      // Regular HTML rendering
      return (
        <div className="relative w-full h-full bg-white dark:bg-gray-950">
          {isInView ? (
            htmlError ? (
              <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                  <FiCode className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Failed to load HTML
                  </p>
                </div>
              </div>
            ) : htmlContent ? (
              isCompactPreview ? (
                <div className="flex h-full w-full items-center justify-center bg-gray-50 dark:bg-gray-900 p-2">
                  <div className="h-full w-full overflow-hidden rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm">
                    <iframe
                      srcDoc={htmlContent}
                      className="border-0 origin-top-left"
                      title={fileName || "HTML Preview"}
                      sandbox="allow-scripts allow-popups"
                      referrerPolicy="no-referrer"
                      style={{
                        transform: `scale(${compactHtmlScale})`,
                        transformOrigin: "top left",
                        width: `${100 / compactHtmlScale}%`,
                        height: `${100 / compactHtmlScale}%`,
                        display: "block",
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className={`h-full ${htmlViewModeClassName}`}>
                  <iframe
                    srcDoc={htmlContent}
                    className="w-full h-full border-0"
                    title={fileName || "HTML Preview"}
                    sandbox="allow-scripts allow-popups"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                  <FiCode className="w-12 h-12 text-blue-400 dark:text-blue-300 mx-auto mb-2 animate-pulse" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Loading HTML...
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800">
              <FiCode className="w-12 h-12 text-blue-400 dark:text-blue-300" />
            </div>
          )}
        </div>
      );
    }

    if (effectiveContentType === "application/json") {
      const codeExecutorLogsPayload =
        tryParseCodeExecutorLogsPayload(jsonContent) ||
        tryParseCodeExecutorLogsPayload(jsonRaw);
      if (codeExecutorLogsPayload) {
        if (isCompactPreview) {
          return (
            <CompactPreviewFrame>
              <CodeExecutorLogsPreview
                payload={codeExecutorLogsPayload}
                variant="compact"
              />
            </CompactPreviewFrame>
          );
        }

        return <CodeExecutorLogsPreview payload={codeExecutorLogsPayload} />;
      }

      const shellExecutorLogsPayload =
        tryParseShellExecutorLogsPayload(jsonContent) ||
        tryParseShellExecutorLogsPayload(jsonRaw);

      if (shellExecutorLogsPayload) {
        if (isCompactPreview) {
          return (
            <CompactPreviewFrame>
              <ShellExecutorLogsPreview
                payload={shellExecutorLogsPayload}
                variant="compact"
              />
            </CompactPreviewFrame>
          );
        }

        return <ShellExecutorLogsPreview payload={shellExecutorLogsPayload} />;
      }

      if (isExecutorLogsFileName(fileName) && typeof jsonRaw === "string") {
      const formattedLogs = formatExecutorLogsContent(jsonRaw);
        return (
          <div className="h-full w-full overflow-y-auto rounded-md bg-[#0d1117] p-3 font-mono text-[11px] text-slate-100">
          <pre className="whitespace-pre-wrap break-words">{formattedLogs}</pre>
          </div>
        );
      }

      if (isCompactPreview) {
        return (
          <CompactPreviewFrame>
            {isInView ? (
              jsonError && !jsonRaw ? (
                <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                  <div className="text-center">
                    <FiCode className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      Failed to load JSON
                    </p>
                  </div>
                </div>
              ) : jsonContent || jsonRaw ? (
                <CompactScaledContent scale={0.82} textClassName="text-[11px] leading-normal">
                  <JsonViewer
                    value={jsonContent}
                    raw={jsonRaw || ""}
                    defaultMode="tree"
                    defaultExpandedDepth={1}
                  />
                </CompactScaledContent>
              ) : (
                <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                  <div className="text-center">
                    <FiCode className="w-10 h-10 text-blue-400 dark:text-blue-300 mx-auto mb-2 animate-pulse" />
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      Loading JSON...
                    </p>
                  </div>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800">
                <FiCode className="w-10 h-10 text-blue-400 dark:text-blue-300" />
              </div>
            )}
          </CompactPreviewFrame>
        );
      }

      if (isInView) {
        if (jsonError && !jsonRaw) {
          return (
            <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
              <div className="text-center">
                <FiCode className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Failed to load JSON
                </p>
              </div>
            </div>
          );
        }

        if (jsonContent || jsonRaw) {
          return (
            <div className="relative w-full h-full bg-white dark:bg-gray-950 flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                <JsonViewer
                  value={jsonContent}
                  raw={jsonRaw || ""}
                  defaultMode="tree"
                  defaultExpandedDepth={2}
                />
              </div>
            </div>
          );
        }

        return (
          <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
            <div className="text-center">
              <FiCode className="w-12 h-12 text-blue-400 dark:text-blue-300 mx-auto mb-2 animate-pulse" />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Loading JSON...
              </p>
            </div>
          </div>
        );
      }
      return (
        <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800">
          <FiCode className="w-12 h-12 text-blue-400 dark:text-blue-300" />
        </div>
      );
    }

    if (isMarkdownLike) {
      const codeExecutorLogsPayload =
        tryParseCodeExecutorLogsPayload(parsedMarkdownJson) ||
        tryParseCodeExecutorLogsPayload(markdownContent);
      if (codeExecutorLogsPayload) {
        if (isCompactPreview) {
          return (
            <CompactPreviewFrame>
              <CodeExecutorLogsPreview
                payload={codeExecutorLogsPayload}
                variant="compact"
              />
            </CompactPreviewFrame>
          );
        }

        return <CodeExecutorLogsPreview payload={codeExecutorLogsPayload} />;
      }

      const shellExecutorLogsPayload =
        tryParseShellExecutorLogsPayload(parsedMarkdownJson) ||
        tryParseShellExecutorLogsPayload(markdownContent);

      if (shellExecutorLogsPayload) {
        if (isCompactPreview) {
          return (
            <CompactPreviewFrame>
              <ShellExecutorLogsPreview
                payload={shellExecutorLogsPayload}
                variant="compact"
              />
            </CompactPreviewFrame>
          );
        }

        return <ShellExecutorLogsPreview payload={shellExecutorLogsPayload} />;
      }

      if (isExecutorLogsFileName(fileName) && markdownContent) {
      const formattedLogs = formatExecutorLogsContent(markdownContent);
        return (
          <div className="h-full w-full overflow-y-auto rounded-md bg-[#0d1117] p-3 font-mono text-[11px] text-slate-100">
          <pre className="whitespace-pre-wrap break-words">{formattedLogs}</pre>
          </div>
        );
      }

      // If we successfully parsed the markdown as JSON, render using JsonViewer
      if (parsedMarkdownJson) {
        const rawJson =
          typeof markdownContent === "string" ? markdownContent : "";
        // Extract raw JSON from code block if needed for the "Raw" view in JsonViewer
        let cleanRaw = rawJson.trim();
        const match = cleanRaw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
        if (match && match[1]) {
          cleanRaw = match[1].trim();
        }

        if (isFullScreen) {
          return (
            <div className="relative w-full h-full bg-white dark:bg-gray-950 flex flex-col">
              {/* Header with view mode switcher */}
              {onViewModeChange && (
                <div className="flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onViewModeChange("desktop")}
                      className={`p-2 rounded-lg transition-colors ${
                        viewMode === "desktop"
                          ? "bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900"
                          : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                      }`}
                      aria-label="Desktop view"
                      title="Desktop view"
                    >
                      <FiMonitor className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onViewModeChange("tablet")}
                      className={`p-2 rounded-lg transition-colors ${
                        viewMode === "tablet"
                          ? "bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900"
                          : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                      }`}
                      aria-label="Tablet view"
                      title="Tablet view"
                    >
                      <FiTablet className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onViewModeChange("mobile")}
                      className={`p-2 rounded-lg transition-colors ${
                        viewMode === "mobile"
                          ? "bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900"
                          : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                      }`}
                      aria-label="Mobile view"
                      title="Mobile view"
                    >
                      <FiSmartphone className="w-5 h-5" />
                    </button>
                  </div>
                  {fileName && (
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-md">
                      {fileName}
                    </div>
                  )}
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-y-auto">
                <div
                  className={`transition-all duration-300 h-full p-4 ${
                    viewMode === "tablet"
                      ? "w-[768px] max-w-[768px] mx-auto border-x border-gray-200 dark:border-gray-800"
                      : viewMode === "mobile"
                        ? "w-[375px] max-w-[375px] mx-auto border-x border-gray-200 dark:border-gray-800"
                        : "w-full"
                  }`}
                >
                  <JsonViewer
                    value={parsedMarkdownJson}
                    raw={cleanRaw}
                    defaultMode="tree"
                    defaultExpandedDepth={2}
                  />
                </div>
              </div>
            </div>
          );
        }

        // Regular (non-fullscreen) view
        if (isCompactPreview) {
          return (
            <CompactPreviewFrame>
              <CompactScaledContent scale={0.82} textClassName="text-[11px] leading-normal">
                <JsonViewer
                  value={parsedMarkdownJson}
                  raw={cleanRaw}
                  defaultMode="tree"
                  defaultExpandedDepth={1}
                />
              </CompactScaledContent>
            </CompactPreviewFrame>
          );
        }

        return (
          <div className="relative w-full h-full bg-white dark:bg-gray-950 overflow-auto p-4">
            <JsonViewer
              value={parsedMarkdownJson}
              raw={cleanRaw}
              defaultMode="tree"
              defaultExpandedDepth={2}
            />
          </div>
        );
      }

      if (isFullScreen) {
        // Full-screen markdown rendering with scrolling + view mode support (desktop/tablet/mobile)
        return (
          <div className="relative w-full h-full bg-white dark:bg-gray-950 flex flex-col">
            {/* Header with view mode switcher */}
            {onViewModeChange && (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <div className="flex gap-2">
                  <button
                    onClick={() => onViewModeChange("desktop")}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === "desktop"
                        ? "bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                    aria-label="Desktop view"
                    title="Desktop view"
                  >
                    <FiMonitor className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onViewModeChange("tablet")}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === "tablet"
                        ? "bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                    aria-label="Tablet view"
                    title="Tablet view"
                  >
                    <FiTablet className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onViewModeChange("mobile")}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === "mobile"
                        ? "bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                    aria-label="Mobile view"
                    title="Mobile view"
                  >
                    <FiSmartphone className="w-5 h-5" />
                  </button>
                </div>
                {fileName && (
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-md">
                    {fileName}
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto">
              {isInView ? (
                markdownError ? (
                  <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                    <div className="text-center">
                      <FiFileText className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Failed to load markdown
                      </p>
                    </div>
                  </div>
                ) : markdownContent ? (
                  <div
                    className={`transition-all duration-300 ${
                      viewMode === "tablet"
                        ? "w-[768px] max-w-[768px] mx-auto"
                        : viewMode === "mobile"
                          ? "w-[375px] max-w-[375px] mx-auto"
                          : "w-full"
                    }`}
                  >
                    <div className="p-8 prose prose-lg max-w-none dark:prose-invert">
                      <MarkdownRenderer
                        value={markdownContent}
                        fallbackClassName="whitespace-pre-wrap break-words"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full bg-black">
                    <div className="text-center">
                      <FiFileText className="w-12 h-12 text-white/50 mx-auto mb-2 animate-pulse" />
                      <p className="text-xs text-white/70">
                        Loading markdown...
                      </p>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center h-full bg-black">
                  <div className="text-center">
                    <FiFileText className="w-12 h-12 text-white/50 mx-auto mb-2" />
                    <p className="text-xs text-white/70">Markdown File</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }

      // Regular markdown rendering
      if (isCompactPreview) {
        return (
          <CompactPreviewFrame>
            {isInView ? (
              markdownError ? (
                <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                  <div className="text-center">
                    <FiFileText className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      Failed to load markdown
                    </p>
                  </div>
                </div>
              ) : markdownContent ? (
                <CompactScaledContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert text-[10px] leading-snug prose-p:my-1 prose-headings:my-1 prose-li:my-0">
                    <MarkdownRenderer
                      value={markdownContent}
                      fallbackClassName="whitespace-pre-wrap break-words"
                    />
                  </div>
                </CompactScaledContent>
              ) : (
                <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                  <div className="text-center">
                    <FiFileText className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-2 animate-pulse" />
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      Loading markdown...
                    </p>
                  </div>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                  <FiFileText className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    Markdown File
                  </p>
                </div>
              </div>
            )}
          </CompactPreviewFrame>
        );
      }

      return (
        <div className="relative w-full h-full bg-white dark:bg-gray-950 overflow-auto">
          {isInView ? (
            markdownError ? (
              <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                  <FiFileText className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Failed to load markdown
                  </p>
                </div>
              </div>
            ) : markdownContent ? (
              <div className="p-4 prose prose-sm max-w-none dark:prose-invert">
                <MarkdownRenderer
                  value={markdownContent}
                  fallbackClassName="whitespace-pre-wrap break-words"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                  <FiFileText className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-2 animate-pulse" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Loading markdown...
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
              <div className="text-center">
                <FiFileText className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Markdown File
                </p>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (effectiveContentType.startsWith("text/")) {
      return (
        <div className="flex items-center justify-center bg-gray-50 dark:bg-gray-900 h-full">
          <div className="text-center">
            <FiFileText className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
            <p className="text-xs text-gray-500 dark:text-gray-400">Text File</p>
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
    <div ref={containerRef} className={`overflow-hidden ${className}`}>
      {renderPreview()}
    </div>
  );
}
