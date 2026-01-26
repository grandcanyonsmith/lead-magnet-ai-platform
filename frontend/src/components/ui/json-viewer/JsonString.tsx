import React, { useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { FiCopy, FiExternalLink, FiImage } from "react-icons/fi";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import {
  MAX_STRING_PREVIEW,
  MAX_STRING_PREVIEW_LINES,
  URL_HOST_MAX,
  URL_PATH_PREVIEW,
  extractFirstFencedBlock,
  formatUrlLabel,
  getLineCount,
  isImageUrl,
  looksLikeMarkdown,
  safeParseUrl,
  takeFirstLines,
  truncateMiddle,
} from "./utils";

function UrlImageThumb({ url }: { url: string }) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="h-8 w-8 rounded-md border border-gray-200 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-center">
        <FiImage className="h-4 w-4 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="h-8 w-8 rounded-md border border-gray-200 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-900/50 overflow-hidden">
      <Image
        src={url}
        alt="Image preview"
        width={32}
        height={32}
        className="h-full w-full object-cover"
        onError={() => setError(true)}
        unoptimized
      />
    </div>
  );
}

function UrlValue({
  value,
  onCopy,
}: {
  value: string;
  onCopy: () => void;
}) {
  const url = safeParseUrl(value);
  if (!url) {
    return (
      <span className="text-amber-700 dark:text-amber-200 whitespace-pre-wrap break-words">
        &quot;{value}&quot;
      </span>
    );
  }
  const { hostLabel, suffix } = formatUrlLabel(url);
  const showImageThumb = isImageUrl(value);

  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-900/60 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 max-w-full">
      {showImageThumb ? (
        <UrlImageThumb url={value} />
      ) : (
        <FiExternalLink className="h-4 w-4 text-gray-400" />
      )}
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 min-w-0 hover:text-gray-900 dark:hover:text-white"
        title={value}
      >
        <span className="font-semibold text-cyan-700 dark:text-cyan-200">
          {hostLabel}
        </span>
        {suffix ? (
          <span className="text-gray-500 dark:text-gray-400 truncate">
            {suffix}
          </span>
        ) : null}
      </a>
      <button
        type="button"
        onClick={onCopy}
        className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        title="Copy URL"
        aria-label="Copy URL"
      >
        <FiCopy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function JsonStringValue({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false);
  const lineCount = getLineCount(value);
  const isMultiline = lineCount > 1;
  const isLongSingleLine = !isMultiline && value.length > MAX_STRING_PREVIEW;
  const isLongMultiline =
    isMultiline &&
    (lineCount > MAX_STRING_PREVIEW_LINES || value.length > MAX_STRING_PREVIEW);
  const shouldCollapse = isLongSingleLine || isLongMultiline;
  const shouldScrollExpanded =
    expanded && (lineCount > 80 || value.length > 8_000);

  const canRenderMarkdown = looksLikeMarkdown(value) && value.length < 250_000;
  const [view, setView] = useState<"text" | "rendered">(() => {
    if (!canRenderMarkdown) return "text";
    return lineCount > 6 || value.length > 900 ? "rendered" : "text";
  });

  const fenced = value.includes("```") ? extractFirstFencedBlock(value) : null;

  const previewText = isMultiline
    ? takeFirstLines(value, MAX_STRING_PREVIEW_LINES)
    : value.slice(0, MAX_STRING_PREVIEW);

  const displayValue =
    !expanded && shouldCollapse ? `${previewText}…` : value;

  const trimmedValue = value.trim();
  const urlCandidate =
    !isMultiline && trimmedValue ? safeParseUrl(trimmedValue) : null;

  const shouldRenderMarkdown =
    canRenderMarkdown && view === "rendered" && (!shouldCollapse || expanded);

  const displayFenced = (() => {
    if (!fenced) return null;
    if (expanded || !shouldCollapse) return fenced;

    const previewCode = takeFirstLines(fenced.code, MAX_STRING_PREVIEW_LINES);
    const codeNeedsEllipsis = previewCode.length < fenced.code.length;
    return {
      ...fenced,
      code: codeNeedsEllipsis ? `${previewCode}…` : previewCode,
      suffix: "",
    };
  })();

  const copyValue = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
      }
    } catch {
      // noop
    }
  };

  return (
    <div className="min-w-0">
      {urlCandidate ? (
        <UrlValue value={trimmedValue} onCopy={copyValue} />
      ) : isMultiline || value.length > MAX_STRING_PREVIEW ? (
        <div className="rounded-lg border border-gray-200 dark:border-slate-700/60 bg-gray-50 dark:bg-slate-950/60">
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-gray-200 dark:border-slate-700/40">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {isMultiline ? `${lineCount.toLocaleString()} lines • ` : ""}
              {value.length.toLocaleString()} chars
              {displayFenced?.language ? ` • ${displayFenced.language}` : ""}
            </span>
            <div className="flex items-center gap-2">
              {canRenderMarkdown && (
                <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-700/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setView("rendered")}
                    className={clsx(
                      "px-2 py-1 text-[11px] font-semibold transition-colors",
                      view === "rendered"
                        ? "bg-cyan-600 text-white"
                        : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-black/20",
                    )}
                    title="Render markdown"
                  >
                    Render
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("text")}
                    className={clsx(
                      "px-2 py-1 text-[11px] font-semibold transition-colors border-l border-gray-200 dark:border-gray-700/40",
                      view === "text"
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-black/20",
                    )}
                    title="Show plain text"
                  >
                    Text
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={copyValue}
                className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                title="Copy value"
              >
                <FiCopy className="h-3.5 w-3.5" />
                Copy
              </button>
              {shouldCollapse && (
                <button
                  type="button"
                  className="text-[11px] text-cyan-600 dark:text-cyan-300 hover:text-cyan-500 dark:hover:text-cyan-200 active:text-cyan-700 dark:active:text-cyan-100 underline underline-offset-2"
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? "less" : "more"}
                </button>
              )}
            </div>
          </div>

          <div className="p-2.5">
            {shouldRenderMarkdown ? (
              <div
                className={clsx(
                  "font-sans text-sm text-gray-900 dark:text-slate-100",
                  shouldScrollExpanded && "max-h-[60vh] overflow-auto",
                )}
              >
                <MarkdownRenderer
                  value={String(value)}
                  fallbackClassName="whitespace-pre-wrap break-words"
                  components={{
                    pre: ({ children }) => <>{children}</>,
                    code: ({ inline, children, ...props }: any) => {
                      if (inline) {
                        return (
                          <code className="rounded bg-gray-200 dark:bg-black/30 px-1 py-0.5 font-mono text-[0.85em] text-amber-700 dark:text-amber-200" {...props}>
                            {children}
                          </code>
                        );
                      }
                      const text = String(children).replace(/\n$/, "");
                      return (
                        <pre className="rounded-md border border-gray-200 dark:border-gray-700/40 bg-gray-100 dark:bg-black/25 p-3 overflow-auto" {...props}>
                          <code className="font-mono text-xs leading-relaxed text-gray-800 dark:text-slate-100 whitespace-pre">
                            {text}
                          </code>
                        </pre>
                      );
                    },
                    table: ({ children }) => (
                      <div className="overflow-x-auto">
                        <table className="w-full">{children}</table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="border-b border-gray-200 dark:border-gray-700/50 px-2 py-1 text-left text-gray-900 dark:text-gray-100">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border-b border-gray-100 dark:border-gray-800/60 px-2 py-1 text-gray-700 dark:text-gray-200 align-top">
                        {children}
                      </td>
                    ),
                  }}
                />
              </div>
            ) : displayFenced ? (
              <div className="space-y-2">
                {displayFenced.prefix.trim() ? (
                  <div className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
                    {displayFenced.prefix.trim()}
                  </div>
                ) : null}
                <pre
                  className={clsx(
                    "rounded-md border border-gray-200 dark:border-slate-700/50 bg-gray-100 dark:bg-slate-950/50 p-3 text-gray-800 dark:text-slate-100 whitespace-pre-wrap break-words leading-relaxed",
                    shouldScrollExpanded && "max-h-[60vh] overflow-auto",
                  )}
                >
                  {displayFenced.code}
                </pre>
                {displayFenced.suffix.trim() ? (
                  <div className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
                    {displayFenced.suffix.trim()}
                  </div>
                ) : null}
              </div>
            ) : (
              <pre
                className={clsx(
                  "text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words leading-relaxed",
                  shouldScrollExpanded && "max-h-[60vh] overflow-auto",
                )}
              >
                {displayValue}
              </pre>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-amber-700 dark:text-amber-200 whitespace-pre-wrap break-words">
            &quot;{displayValue}&quot;
          </span>
          <button
            type="button"
            onClick={copyValue}
            className="mt-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            title="Copy value"
            aria-label="Copy value"
          >
            <FiCopy className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
