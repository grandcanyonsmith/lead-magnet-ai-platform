import { FiCode, FiFileText } from "react-icons/fi";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import {
  ShellExecutorLogsPreview,
} from "@/components/artifacts/ShellExecutorLogsPreview";
import {
  CodeExecutorLogsPreview,
} from "@/components/artifacts/CodeExecutorLogsPreview";
import { CompactPreviewFrame } from "./CompactPreviewFrame";
import { JsonViewToggle } from "./JsonViewToggle";
import { PreviewHeader } from "./PreviewHeader";
import {
  tryParseCodeExecutorLogsPayload,
  tryParseShellExecutorLogsPayload,
  isExecutorLogsFileName,
  formatExecutorLogsContent,
} from "./utils";

interface JsonPreviewProps {
  isFullScreen: boolean;
  isCompactPreview: boolean;
  viewMode?: "desktop" | "tablet" | "mobile";
  onViewModeChange?: (mode: "desktop" | "tablet" | "mobile") => void;
  fileName?: string;
  isInView: boolean;
  jsonContent: any;
  jsonRaw: string | null;
  jsonError: boolean;
  jsonMarkdownPreview: string | null;
  resolvedJsonViewMode: "markdown" | "json";
  setJsonViewMode: (mode: "markdown" | "json") => void;
}

export function JsonPreview({
  isFullScreen,
  isCompactPreview,
  viewMode,
  onViewModeChange,
  fileName,
  isInView,
  jsonContent,
  jsonRaw,
  jsonError,
  jsonMarkdownPreview,
  resolvedJsonViewMode,
  setJsonViewMode,
}: JsonPreviewProps) {
  const COMPACT_MARKDOWN_PREVIEW_CHARS = 700;

  const buildCompactMarkdownPreview = (value?: string | null): string | null => {
    if (!value) return null;
    const normalized = value
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!normalized) return null;
    if (normalized.length > COMPACT_MARKDOWN_PREVIEW_CHARS) {
      return `${normalized.slice(0, COMPACT_MARKDOWN_PREVIEW_CHARS)}\n\n_(truncated)_`;
    }
    return normalized;
  };

  const renderCompactMarkdownPreview = (params: {
    markdown?: string | null;
    icon: React.ReactNode;
    emptyLabel: string;
    loadingLabel?: string;
  }) => {
    const markdown = buildCompactMarkdownPreview(params.markdown);
    const label = params.loadingLabel ?? params.emptyLabel;
    return (
      <CompactPreviewFrame>
        {isInView ? (
          markdown ? (
            <div className="h-full w-full overflow-hidden p-2">
              <div className="prose prose-sm max-w-none dark:prose-invert text-[10px] leading-snug prose-p:my-1 prose-headings:my-1 prose-li:my-0 prose-pre:my-2">
                <MarkdownRenderer
                  value={markdown}
                  fallbackClassName="whitespace-pre-wrap break-words"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
              <div className="text-center">
                {params.icon}
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  {label}
                </p>
              </div>
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
            <div className="text-center">
              {params.icon}
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                {params.emptyLabel}
              </p>
            </div>
          </div>
        )}
      </CompactPreviewFrame>
    );
  };

  const renderJsonMarkdownPreview = (markdownValue: string) => {
    if (isFullScreen) {
      return (
        <div className="relative w-full h-full bg-white dark:bg-gray-950 flex flex-col">
          <PreviewHeader
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            fileName={fileName}
          />
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="px-6 pt-4">
              <JsonViewToggle
                viewMode={resolvedJsonViewMode}
                onChange={setJsonViewMode}
                className="justify-end"
              />
            </div>
            <div
              className={`transition-all duration-300 ${
                viewMode === "tablet"
                  ? "w-[768px] max-w-[768px] mx-auto"
                  : viewMode === "mobile"
                    ? "w-[375px] max-w-[375px] mx-auto"
                    : "w-full"
              }`}
            >
              <div className="p-8 pt-6 prose prose-lg max-w-none dark:prose-invert">
                <MarkdownRenderer
                  value={markdownValue}
                  fallbackClassName="whitespace-pre-wrap break-words"
                />
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (isCompactPreview) {
      return renderCompactMarkdownPreview({
        markdown: markdownValue,
        icon: (
          <FiFileText className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
        ),
        emptyLabel: "Markdown Preview",
        loadingLabel: "Loading markdown...",
      });
    }

    return (
      <div
        className="relative w-full h-full bg-white dark:bg-gray-950 overflow-auto"
        style={{ contain: "layout style paint" }}
      >
        {isInView ? (
          <div className="p-4 space-y-3">
            <JsonViewToggle
              viewMode={resolvedJsonViewMode}
              onChange={setJsonViewMode}
              className="justify-end"
            />
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <MarkdownRenderer
                value={markdownValue}
                fallbackClassName="whitespace-pre-wrap break-words"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
            <div className="text-center">
              <FiFileText className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Markdown Preview
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

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

  if (resolvedJsonViewMode === "markdown" && jsonMarkdownPreview) {
    return renderJsonMarkdownPreview(jsonMarkdownPreview);
  }

  if (isCompactPreview) {
    const jsonPreviewText =
      jsonMarkdownPreview ||
      (typeof jsonRaw === "string"
        ? `\`\`\`json\n${jsonRaw}\n\`\`\``
        : jsonContent
          ? `\`\`\`json\n${JSON.stringify(jsonContent, null, 2)}\n\`\`\``
          : null);
    return renderCompactMarkdownPreview({
      markdown: jsonPreviewText,
      icon: (
        <FiCode className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
      ),
      emptyLabel: jsonError ? "Failed to load JSON" : "JSON Preview",
      loadingLabel: jsonError ? "Failed to load JSON" : "Loading JSON...",
    });
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
        <div
          className="relative w-full h-full bg-white dark:bg-gray-950 flex flex-col"
          style={{ contain: "layout style paint", minHeight: 0 }}
        >
          <div
            className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3"
            style={{ willChange: "scroll-position", minHeight: 0 }}
          >
            <JsonViewToggle
              viewMode={resolvedJsonViewMode}
              onChange={setJsonViewMode}
              className="justify-end"
            />
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
