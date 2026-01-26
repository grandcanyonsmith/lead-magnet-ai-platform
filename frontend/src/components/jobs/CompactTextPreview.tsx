"use client";

import { useMemo } from "react";
import { ClipboardDocumentIcon, ArrowsPointingOutIcon } from "@heroicons/react/24/outline";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";

const JSON_MARKDOWN_SINGLE_KEYS = new Set([
  "markdown",
  "md",
  "content",
  "body",
  "text",
  "output",
  "result",
]);

const extractMarkdownFromJson = (text: string): string | null => {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      // Check for single field with markdown key
      const entries = Object.entries(parsed);
      if (entries.length === 1) {
        const [key, value] = entries[0] ?? [];
        const normalizedKey = String(key || "").toLowerCase();
        if (JSON_MARKDOWN_SINGLE_KEYS.has(normalizedKey) && typeof value === "string") {
          return value;
        }
      }
      // Check for nested markdown fields
      for (const [key, value] of entries) {
        const normalizedKey = String(key || "").toLowerCase();
        if (JSON_MARKDOWN_SINGLE_KEYS.has(normalizedKey) && typeof value === "string") {
          return value;
        }
        // Recursively check nested objects
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          const nested = extractMarkdownFromJson(JSON.stringify(value));
          if (nested) return nested;
        }
      }
    }
  } catch {
    // Not valid JSON or parsing failed
  }
  return null;
};

export const CompactTextPreview = ({
  text,
  format,
  onCopy,
  onExpand,
}: {
  text: string;
  format?: "json" | "markdown" | "text" | "html";
  onCopy?: () => void;
  onExpand?: () => void;
}) => {
  // Try to extract markdown from JSON if format is json
  const markdownContent = useMemo(() => {
    if (format === "json") {
      const extracted = extractMarkdownFromJson(text);
      if (extracted) return extracted;
    }
    if (format === "markdown") {
      return text;
    }
    return null;
  }, [text, format]);

  const shouldRenderMarkdown = markdownContent !== null;

  return (
    <div
      className="relative w-full h-full bg-gray-50 dark:bg-gray-900 p-2 group/preview"
      style={{ contain: "layout style paint", minHeight: 0 }}
    >
        <div className="h-full w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-md relative">
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover/preview:opacity-100 bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm rounded-lg p-1 border border-gray-200 dark:border-gray-800 shadow-lg">
          {onCopy && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCopy();
              }}
              className="p-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Copy"
            >
              <ClipboardDocumentIcon className="w-3.5 h-3.5" />
            </button>
          )}
          {onExpand && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onExpand();
              }}
              className="p-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Expand details"
            >
              <ArrowsPointingOutIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="h-full overflow-y-auto p-3 text-[11px] leading-relaxed text-gray-900 dark:text-gray-100 scrollbar-hide">
          {shouldRenderMarkdown ? (
            <div className="prose prose-sm max-w-none dark:prose-invert text-[11px] leading-relaxed prose-p:my-2 prose-p:text-gray-800 dark:prose-p:text-gray-100 prose-headings:my-2.5 prose-headings:font-bold prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-h2:text-[13px] prose-h3:text-[12px] prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-li:text-gray-800 dark:prose-li:text-gray-100 prose-pre:my-2 prose-table:w-full prose-table:border-collapse prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-700 prose-th:bg-gray-50 dark:prose-th:bg-gray-900 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:text-gray-900 dark:prose-th:text-gray-100 prose-td:border prose-td:border-gray-200 dark:prose-td:border-gray-800 prose-td:px-3 prose-td:py-2 prose-td:text-gray-700 dark:prose-td:text-gray-200 prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[10px] prose-code:font-mono prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-strong:font-semibold">
              <MarkdownRenderer
                value={markdownContent}
                fallbackClassName="whitespace-pre-wrap break-words"
              />
            </div>
          ) : (
            <div className="whitespace-pre-wrap break-words text-gray-800 dark:text-gray-100">
              {text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
