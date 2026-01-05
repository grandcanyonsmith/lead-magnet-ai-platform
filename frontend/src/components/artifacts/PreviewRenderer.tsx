import { useState, useEffect, useRef, useMemo } from "react";
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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api";
import { JsonViewer } from "@/components/ui/JsonViewer";

interface PreviewRendererProps {
  contentType?: string;
  objectUrl?: string;
  fileName?: string;
  className?: string;
  artifactId?: string;
  isFullScreen?: boolean;
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

export function PreviewRenderer({
  contentType,
  objectUrl,
  fileName,
  className = "",
  artifactId,
  isFullScreen = false,
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine effective content type with fallback to file extension
  const effectiveContentType =
    contentType ||
    detectContentTypeFromExtension(fileName) ||
    "application/octet-stream";

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

  // Reset error state when objectUrl changes (switching to different artifact)
  useEffect(() => {
    if (objectUrl) {
      setMarkdownError(false);
      setMarkdownContent(null);
      setHtmlError(false);
      setHtmlContent(null);
      setJsonError(false);
      setJsonContent(null);
      setJsonRaw(null);
    }
  }, [objectUrl]);

  // Fetch markdown content when in view
  useEffect(() => {
    if (
      isInView &&
      effectiveContentType === "text/markdown" &&
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
          } else if (objectUrl) {
            // Fallback to direct URL fetch
            const res = await fetch(objectUrl);
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
    effectiveContentType,
    objectUrl,
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
          } else if (objectUrl) {
            // Fallback to direct URL fetch
            const res = await fetch(objectUrl);
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
    objectUrl,
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
          } else if (objectUrl) {
            const res = await fetch(objectUrl);
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
    objectUrl,
    artifactId,
    jsonContent,
    jsonError,
  ]);

  // Attempt to parse markdown content as JSON if it looks like one
  const parsedMarkdownJson = useMemo(() => {
    if (!markdownContent || effectiveContentType !== "text/markdown")
      return null;
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
  }, [markdownContent, effectiveContentType]);

  if (!objectUrl && !artifactId) {
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
            {isInView && objectUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={objectUrl}
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
          {isInView && objectUrl && (
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <Image
                src={objectUrl}
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
          {isInView && objectUrl ? (
            <iframe
              src={`${objectUrl}#toolbar=0&navpanes=0&scrollbar=0`}
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
              <iframe
                srcDoc={htmlContent}
                className="w-full h-full border-0"
                title={fileName || "HTML Preview"}
                sandbox="allow-scripts allow-popups"
                referrerPolicy="no-referrer"
              />
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

    if (effectiveContentType === "text/markdown") {
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
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {markdownContent}
                      </ReactMarkdown>
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
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {markdownContent}
                </ReactMarkdown>
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
