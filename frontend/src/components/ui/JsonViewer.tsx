"use client";

import React, { useState } from "react";
import clsx from "clsx";
import { FiChevronRight } from "react-icons/fi";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

type JsonViewMode = "tree" | "raw";

interface JsonViewerProps {
  value: unknown;
  raw: string;
  defaultMode?: JsonViewMode;
  className?: string;
  defaultExpandedDepth?: number;
}

const MAX_SYNTAX_HIGHLIGHT_CHARS = 50_000;
const MAX_CHILDREN_PREVIEW = 60;
const MAX_STRING_PREVIEW = 280;

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
        <span className="text-sky-300 shrink-0">{name}:</span>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function JsonStringValue({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = value.length > MAX_STRING_PREVIEW;
  const displayValue =
    !expanded && isLong ? `${value.slice(0, MAX_STRING_PREVIEW)}…` : value;

  return (
    <div className="min-w-0">
      <span className="text-amber-200 whitespace-pre-wrap break-words">
        &quot;{displayValue}&quot;
      </span>
      {isLong && (
        <button
          type="button"
          className="ml-2 text-[11px] text-sky-300 hover:text-sky-200 active:text-sky-100 underline underline-offset-2"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded
            ? "less"
            : `more (${value.length.toLocaleString()} chars)`}
        </button>
      )}
    </div>
  );
}

function JsonPrimitiveValue({ value }: { value: unknown }) {
  if (value === null) {
    return <span className="text-gray-400">null</span>;
  }
  if (value === undefined) {
    return <span className="text-gray-400">undefined</span>;
  }
  if (typeof value === "string") {
    return <JsonStringValue value={value} />;
  }
  if (typeof value === "number") {
    return <span className="text-emerald-200">{String(value)}</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-purple-200">{value ? "true" : "false"}</span>;
  }
  if (typeof value === "bigint") {
    return <span className="text-emerald-200">{String(value)}n</span>;
  }
  return <span className="text-gray-200">{String(value)}</span>;
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
              "mt-0.5 h-3.5 w-3.5 text-gray-400 shrink-0 transition-transform",
              isOpen && "rotate-90",
            )}
          />
          <div className="min-w-0 flex-1">
            <span className="text-sky-300">{name ?? "(root)"}</span>
            <span className="text-gray-400">: </span>
            <span className="text-gray-200">[</span>
            <span className="text-gray-400">{formatItemCount(total)}</span>
            <span className="text-gray-200">]</span>
          </div>
        </summary>

        <div className="pl-5 ml-[7px] border-l border-gray-700/60">
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
              className="mt-1 text-[11px] text-sky-300 hover:text-sky-200 active:text-sky-100 underline underline-offset-2"
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
              "mt-0.5 h-3.5 w-3.5 text-gray-400 shrink-0 transition-transform",
              isOpen && "rotate-90",
            )}
          />
          <div className="min-w-0 flex-1">
            <span className="text-sky-300">{name ?? "(root)"}</span>
            <span className="text-gray-400">: </span>
            <span className="text-gray-200">{"{"}</span>
            <span className="text-gray-400">{formatKeyCount(total)}</span>
            {previewKeys.length > 0 && (
              <span className="text-gray-500">
                {" "}
                • {previewKeys.join(", ")}
                {total > previewKeys.length ? ", …" : ""}
              </span>
            )}
            <span className="text-gray-200">{"}"}</span>
          </div>
        </summary>

        <div className="pl-5 ml-[7px] border-l border-gray-700/60">
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
              className="mt-1 text-[11px] text-sky-300 hover:text-sky-200 active:text-sky-100 underline underline-offset-2"
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
        <span className="text-gray-200">
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
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="bg-[#1e1e1e] text-gray-100 font-mono text-xs leading-relaxed p-4">
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
  raw,
  defaultMode = "tree",
  className = "",
  defaultExpandedDepth = 2,
}: JsonViewerProps) {
  const [mode, setMode] = useState<JsonViewMode>(defaultMode);
  const [wrapLongLines, setWrapLongLines] = useState(true);
  const [forceHighlight, setForceHighlight] = useState(false);

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
                style={vscDarkPlus}
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
            <pre className="rounded-xl border border-gray-200 dark:border-gray-700 bg-[#1e1e1e] text-gray-100 font-mono text-xs leading-relaxed p-4 whitespace-pre-wrap break-words">
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


