"use client";

import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { useTheme } from "next-themes";
import { JsonNode } from "./JsonNode";
import { MAX_SYNTAX_HIGHLIGHT_CHARS } from "./utils";

type JsonViewMode = "tree" | "raw";

export interface JsonViewerProps {
  value: unknown;
  raw?: string;
  defaultMode?: JsonViewMode;
  className?: string;
  defaultExpandedDepth?: number;
}

type PrismStyles = {
  dark: unknown;
  light: unknown;
};

function LazySyntaxHighlighter({
  value,
  language,
  themeMode,
  className,
  ...props
}: {
  value: string;
  language?: string;
  themeMode?: string;
  className?: string;
  [key: string]: any;
}) {
  const [SyntaxHighlighter, setSyntaxHighlighter] =
    useState<React.ComponentType<any> | null>(null);
  const [styles, setStyles] = useState<PrismStyles | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      import("react-syntax-highlighter"),
      import("react-syntax-highlighter/dist/esm/styles/prism"),
    ])
      .then(([syntaxModule, styleModule]) => {
        if (!active) return;
        setSyntaxHighlighter(() => syntaxModule.Prism);
        setStyles({
          dark: styleModule.vscDarkPlus,
          light: styleModule.vs,
        });
      })
      .catch(() => {
        if (active) {
          setSyntaxHighlighter(null);
          setStyles(null);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (!SyntaxHighlighter || !styles) {
    return (
      <pre className={clsx("whitespace-pre-wrap break-words", className)}>
        {value}
      </pre>
    );
  }

  const theme = themeMode === "dark" ? styles.dark : styles.light;

  return (
    <SyntaxHighlighter
      language={language}
      style={theme}
      className={className}
      {...props}
    >
      {value}
    </SyntaxHighlighter>
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
      <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700/60" style={{ contain: 'layout style paint' }}>
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
    <div className={clsx("space-y-2", className)} style={{ contain: 'layout style paint' }}>
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
              <LazySyntaxHighlighter
                value={raw}
                language="json"
                themeMode={resolvedTheme}
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
              />
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
