"use client";

import React, { useState } from "react";
import clsx from "clsx";
import {
  FiChevronRight,
  FiCopy,
  FiExternalLink,
  FiImage,
} from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus, vs } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "next-themes";

type JsonViewMode = "tree" | "raw";

interface JsonViewerProps {
  value: unknown;
  raw?: string;
  defaultMode?: JsonViewMode;
  className?: string;
  defaultExpandedDepth?: number;
}

const MAX_SYNTAX_HIGHLIGHT_CHARS = 50_000;
const MAX_CHILDREN_PREVIEW = 60;
const MAX_STRING_PREVIEW = 280;
const MAX_STRING_PREVIEW_LINES = 14;
const URL_PATH_PREVIEW = 42;
const URL_HOST_MAX = 32;

function truncateMiddle(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  const headLength = Math.max(6, Math.floor(maxLength * 0.6));
  const tailLength = Math.max(4, maxLength - headLength - 3);
  return `${text.slice(0, headLength)}...${text.slice(text.length - tailLength)}`;
}

function safeParseUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function isImageUrl(value: string) {
  if (value.startsWith("data:image/")) return true;
  const url = safeParseUrl(value);
  if (!url) return false;
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(url.pathname);
}

function formatUrlLabel(url: URL) {
  const host = url.hostname.replace(/^www\./, "");
  const hostLabel = truncateMiddle(host, URL_HOST_MAX);
  const path = url.pathname === "/" ? "" : url.pathname;
  const query = url.search ? `?${url.searchParams.toString()}` : "";
  const suffix = truncateMiddle(`${path}${query}`, URL_PATH_PREVIEW);
  return { hostLabel, suffix };
}

function getLineCount(text: string): number {
  let count = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) count += 1; // '\n'
  }
  return count;
}

function takeFirstLines(text: string, maxLines: number): string {
  if (maxLines <= 0) return "";
  let lineCount = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      lineCount += 1;
      if (lineCount > maxLines) {
        return text.slice(0, i);
      }
    }
  }
  return text;
}

type FencedBlock = {
  prefix: string;
  language?: string;
  code: string;
  suffix: string;
};

function extractFirstFencedBlock(text: string): FencedBlock | null {
  const open = text.indexOf("```");
  if (open === -1) return null;

  const openLineEnd = text.indexOf("\n", open + 3);
  if (openLineEnd === -1) return null;

  const language = text.slice(open + 3, openLineEnd).trim() || undefined;
  const codeStart = openLineEnd + 1;

  const close = text.indexOf("```", codeStart);
  if (close === -1) return null;

  const prefix = text.slice(0, open);
  const code = text.slice(codeStart, close);
  const suffix = text.slice(close + 3).replace(/^\n/, "");

  return { prefix, language, code, suffix };
}

function looksLikeMarkdown(text: string): boolean {
  if (!text) return false;
  if (text.includes("```")) return true;
  if (/(^|\n)#{1,6}\s+\S/.test(text)) return true;
  if (/(^|\n)[*-]\s+\S/.test(text)) return true;
  if (/(^|\n)\d+\.\s+\S/.test(text)) return true;
  if (/\|.+\|\n\|[-:\s|]+\|/.test(text)) return true;
  if (/\*\*[^*]+\*\*/.test(text)) return true;
  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function formatKeyCount(count: number) {
  return count === 1 ? "1 key" : `${count.toLocaleString()} keys`;
}

function formatItemCount(count: number) {
  return count === 1 ? "1 item" : `${count.toLocaleString()} items`;
}

function JsonLeafRow({
  name,
  children,
}: {
  name?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 py-0.5 min-w-0">
      {name !== undefined && (
        <span className="text-cyan-700 dark:text-cyan-300 shrink-0">
          {name}:
        </span>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

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
      <img
        src={url}
        alt="Image preview"
        loading="lazy"
        className="h-full w-full object-cover"
        onError={() => setError(true)}
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

function JsonStringValue({ value }: { value: string }) {
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
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
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
                >
                  {value}
                </ReactMarkdown>
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
      )}
    </div>
  );
}

function JsonPrimitiveValue({ value }: { value: unknown }) {
  if (value === null) {
    return <span className="text-gray-500 dark:text-gray-400">null</span>;
  }
  if (value === undefined) {
    return <span className="text-gray-500 dark:text-gray-400">undefined</span>;
  }
  if (typeof value === "string") {
    return <JsonStringValue value={value} />;
  }
  if (typeof value === "number") {
    return (
      <span className="text-emerald-600 dark:text-emerald-300">
        {String(value)}
      </span>
    );
  }
  if (typeof value === "boolean") {
    return (
      <span className="text-purple-600 dark:text-purple-300">
        {value ? "true" : "false"}
      </span>
    );
  }
  if (typeof value === "bigint") {
    return (
      <span className="text-emerald-600 dark:text-emerald-300">
        {String(value)}n
      </span>
    );
  }
  return <span className="text-gray-700 dark:text-gray-200">{String(value)}</span>;
}

function JsonNode({
  name,
  value,
  depth,
  defaultExpandedDepth,
  ancestors,
}: {
  name?: string;
  value: unknown;
  depth: number;
  defaultExpandedDepth: number;
  ancestors: object[];
}) {
  const [isOpen, setIsOpen] = useState(depth < defaultExpandedDepth);
  const [showAllChildren, setShowAllChildren] = useState(false);

  const isObjectLike = typeof value === "object" && value !== null;
  const nextAncestors =
    isObjectLike && (Array.isArray(value) || isPlainObject(value))
      ? [...ancestors, value as object]
      : ancestors;

  if (isObjectLike) {
    const obj = value as object;
    if (ancestors.includes(obj)) {
      return (
        <JsonLeafRow name={name}>
          <span className="text-gray-400">[Circular]</span>
        </JsonLeafRow>
      );
    }
  }

  if (Array.isArray(value)) {
    const total = value.length;
    const shown = showAllChildren ? total : Math.min(total, MAX_CHILDREN_PREVIEW);
    const remaining = total - shown;

    return (
      <details
        open={isOpen}
        onToggle={(e) => {
          const nextOpen = (e.currentTarget as HTMLDetailsElement).open;
          setIsOpen(nextOpen);
        }}
        className="select-none"
      >
        <summary className="list-none cursor-pointer flex items-start gap-2 py-0.5">
          <FiChevronRight
            className={clsx(
              "mt-0.5 h-3.5 w-3.5 text-gray-500 dark:text-gray-400 shrink-0 transition-transform",
              isOpen && "rotate-90",
            )}
          />
          <div className="min-w-0 flex-1">
            <span className="text-cyan-700 dark:text-cyan-300">{name ?? "(root)"}</span>
            <span className="text-gray-500 dark:text-gray-400">: </span>
            <span className="text-gray-700 dark:text-gray-200">[</span>
            <span className="text-gray-500 dark:text-gray-400">{formatItemCount(total)}</span>
            <span className="text-gray-700 dark:text-gray-200">]</span>
          </div>
        </summary>

        <div className="pl-5 ml-[7px] border-l border-gray-200 dark:border-gray-700/60">
          {value.slice(0, shown).map((item, idx) => (
            <JsonNode
              key={`${name ?? "root"}-idx-${idx}`}
              name={`[${idx}]`}
              value={item}
              depth={depth + 1}
              defaultExpandedDepth={defaultExpandedDepth}
              ancestors={nextAncestors}
            />
          ))}
          {remaining > 0 && (
            <button
              type="button"
              className="mt-1 text-[11px] text-cyan-600 dark:text-cyan-300 hover:text-cyan-500 dark:hover:text-cyan-200 active:text-cyan-700 dark:active:text-cyan-100 underline underline-offset-2"
              onClick={() => setShowAllChildren(true)}
            >
              Show {remaining.toLocaleString()} more…
            </button>
          )}
        </div>
      </details>
    );
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    const total = keys.length;
    const shown = showAllChildren ? total : Math.min(total, MAX_CHILDREN_PREVIEW);
    const remaining = total - shown;
    const previewKeys = keys.slice(0, 3);

    return (
      <details
        open={isOpen}
        onToggle={(e) => {
          const nextOpen = (e.currentTarget as HTMLDetailsElement).open;
          setIsOpen(nextOpen);
        }}
        className="select-none"
      >
        <summary className="list-none cursor-pointer flex items-start gap-2 py-0.5">
          <FiChevronRight
            className={clsx(
              "mt-0.5 h-3.5 w-3.5 text-gray-500 dark:text-gray-400 shrink-0 transition-transform",
              isOpen && "rotate-90",
            )}
          />
          <div className="min-w-0 flex-1">
            <span className="text-cyan-700 dark:text-cyan-300">{name ?? "(root)"}</span>
            <span className="text-gray-500 dark:text-gray-400">: </span>
            <span className="text-gray-700 dark:text-gray-200">{"{"}</span>
            <span className="text-gray-500 dark:text-gray-400">{formatKeyCount(total)}</span>
            {previewKeys.length > 0 && (
              <span className="text-gray-500 dark:text-gray-400">
                {" "}
                • {previewKeys.join(", ")}
                {total > previewKeys.length ? ", …" : ""}
              </span>
            )}
            <span className="text-gray-700 dark:text-gray-200">{"}"}</span>
          </div>
        </summary>

        <div className="pl-5 ml-[7px] border-l border-gray-200 dark:border-gray-700/60">
          {keys.slice(0, shown).map((key) => (
            <JsonNode
              key={`${name ?? "root"}-key-${key}`}
              name={key}
              value={(value as Record<string, unknown>)[key]}
              depth={depth + 1}
              defaultExpandedDepth={defaultExpandedDepth}
              ancestors={nextAncestors}
            />
          ))}
          {remaining > 0 && (
            <button
              type="button"
              className="mt-1 text-[11px] text-cyan-600 dark:text-cyan-300 hover:text-cyan-500 dark:hover:text-cyan-200 active:text-cyan-700 dark:active:text-cyan-100 underline underline-offset-2"
              onClick={() => setShowAllChildren(true)}
            >
              Show {remaining.toLocaleString()} more…
            </button>
          )}
        </div>
      </details>
    );
  }

  // Fallback for non-plain objects (Date, etc.)
  if (isObjectLike) {
    return (
      <JsonLeafRow name={name}>
        <span className="text-gray-700 dark:text-gray-200">
          {Object.prototype.toString.call(value)}
        </span>
      </JsonLeafRow>
    );
  }

  return (
    <JsonLeafRow name={name}>
      <JsonPrimitiveValue value={value} />
    </JsonLeafRow>
  );
}

function JsonTree({
  value,
  defaultExpandedDepth = 2,
}: {
  value: unknown;
  defaultExpandedDepth?: number;
}) {
  return (
      <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700/60">
        <div className="bg-gray-50 dark:bg-slate-950/70 text-gray-900 dark:text-slate-100 font-mono text-xs leading-relaxed p-4">
        <JsonNode
          value={value}
          depth={0}
          defaultExpandedDepth={defaultExpandedDepth}
          ancestors={[]}
        />
      </div>
    </div>
  );
}

export function JsonViewer({
  value,
  raw: providedRaw,
  defaultMode = "tree",
  className = "",
  defaultExpandedDepth = 2,
}: JsonViewerProps) {
  const { resolvedTheme } = useTheme();
  const [mode, setMode] = useState<JsonViewMode>(defaultMode);
  const [wrapLongLines, setWrapLongLines] = useState(true);
  const [forceHighlight, setForceHighlight] = useState(false);

  const raw = providedRaw ?? JSON.stringify(value, null, 2);
  const isLarge = raw.length > MAX_SYNTAX_HIGHLIGHT_CHARS;
  const shouldHighlight = !isLarge || forceHighlight;

  return (
    <div className={clsx("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode("tree")}
            className={clsx(
              "px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors touch-target min-h-[44px] sm:min-h-0",
              mode === "tree"
                ? "bg-primary-600 text-white border-primary-600"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700",
            )}
          >
            Tree
          </button>
          <button
            type="button"
            onClick={() => setMode("raw")}
            className={clsx(
              "px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors touch-target min-h-[44px] sm:min-h-0",
              mode === "raw"
                ? "bg-primary-600 text-white border-primary-600"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700",
            )}
          >
            Raw
          </button>
        </div>

        {mode === "raw" && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setWrapLongLines((v) => !v)}
              className={clsx(
                "px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors touch-target min-h-[44px] sm:min-h-0",
                wrapLongLines
                  ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-700 dark:border-gray-600"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700",
              )}
              title="Toggle line wrapping"
            >
              Wrap {wrapLongLines ? "On" : "Off"}
            </button>

            {isLarge && !forceHighlight && (
              <button
                type="button"
                onClick={() => setForceHighlight(true)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-target min-h-[44px] sm:min-h-0"
                title="Enable syntax highlighting (may be slow for large outputs)"
              >
                Highlight
              </button>
            )}
          </div>
        )}
      </div>

      {mode === "tree" ? (
        <JsonTree value={value} defaultExpandedDepth={defaultExpandedDepth} />
      ) : (
        <div className="space-y-2">
          {shouldHighlight ? (
            <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <SyntaxHighlighter
                language="json"
                style={resolvedTheme === "dark" ? vscDarkPlus : vs}
                customStyle={{
                  margin: 0,
                  padding: "16px",
                  fontSize: "13px",
                  lineHeight: "1.65",
                  overflowX: wrapLongLines ? "hidden" : "auto",
                  overflowY: "visible",
                  background: "transparent",
                }}
                codeTagProps={{
                  style: {
                    whiteSpace: wrapLongLines ? "pre-wrap" : "pre",
                    wordBreak: wrapLongLines ? "break-word" : "normal",
                  },
                }}
                wrapLongLines={wrapLongLines}
                showLineNumbers={raw.length > 500}
              >
                {raw}
              </SyntaxHighlighter>
            </div>
          ) : (
            <pre className="rounded-xl border border-gray-200 dark:border-slate-700/60 bg-gray-50 dark:bg-slate-950/70 text-gray-900 dark:text-slate-100 font-mono text-xs leading-relaxed p-4 whitespace-pre-wrap break-words">
              {raw}
            </pre>
          )}

          {isLarge && !forceHighlight && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Syntax highlighting is disabled for large outputs to keep the UI
              responsive. Use <span className="font-medium">Highlight</span> if
              you really want it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}


