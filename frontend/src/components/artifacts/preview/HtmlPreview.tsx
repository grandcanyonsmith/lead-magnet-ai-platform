import { FiCode } from "react-icons/fi";
import { PreviewHeader } from "./PreviewHeader";

interface HtmlPreviewProps {
  isFullScreen: boolean;
  isCompactPreview: boolean;
  viewMode?: "desktop" | "tablet" | "mobile";
  onViewModeChange?: (mode: "desktop" | "tablet" | "mobile") => void;
  fileName?: string;
  isInView: boolean;
  htmlContent: string | null;
  htmlError: boolean;
}

export function HtmlPreview({
  isFullScreen,
  isCompactPreview,
  viewMode,
  onViewModeChange,
  fileName,
  isInView,
  htmlContent,
  htmlError,
}: HtmlPreviewProps) {
  const compactHtmlScale = 0.5;
  const htmlViewModeClassName =
    viewMode === "tablet"
      ? "w-full max-w-[768px] mx-auto"
      : viewMode === "mobile"
        ? "w-full max-w-[375px] mx-auto"
        : "w-full";

  if (isFullScreen) {
    // Full-screen HTML rendering with view mode support
    return (
      <div className="relative w-full h-full bg-white dark:bg-gray-950 flex flex-col">
        <PreviewHeader
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          fileName={fileName}
        />

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
