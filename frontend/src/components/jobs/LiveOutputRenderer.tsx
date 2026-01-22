"use client";

import React, { forwardRef, useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiCode, FiTerminal } from "react-icons/fi";
import { formatLiveOutputText } from "@/utils/jobFormatting";

type LiveOutputSegment =
  | { type: "text"; content: string }
  | { type: "tool_output"; content: string }
  | { type: "code"; content: string }
  | { type: "code_logs"; content: string }
  | { type: "code_error"; content: string }
  | { type: "code_status"; content: string };

type PythonSegment = { type: "text" | "python"; content: string };

const PYTHON_HEREDOC_START =
  /^\$\s+python(?:\d+(?:\.\d+)?)?(?:\s|$).*<<\s*['"]?([A-Za-z0-9_]+)['"]?/i;
const PYTHON_DASH_C = /^\$?\s*python(?:\d+(?:\.\d+)?)?\s+-c\s+/i;

const CODE_MARKER = /^\[Code interpreter\](.*)$/i;
const CODE_LOGS_MARKER = /^\[Code interpreter logs\]\s*$/i;
const CODE_ERROR_MARKER = /^\[Code interpreter error\]\s*$/i;
const TOOL_OUTPUT_MARKER = /^\[Tool output\]\s*$/i;

const normalizeEscapes = (value: string) =>
  value
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");

const extractPythonDashC = (line: string): string | null => {
  const match = line.match(PYTHON_DASH_C);
  if (!match) return null;
  const rest = line.slice(match[0].length).trimStart();
  const quote = rest[0];
  if (quote !== '"' && quote !== "'") return null;
  let code = "";
  let escaped = false;
  for (let i = 1; i < rest.length; i += 1) {
    const ch = rest[i];
    if (escaped) {
      code += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === quote) {
      return normalizeEscapes(code);
    }
    code += ch;
  }
  return null;
};

const extractJsonCandidate = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const firstBrace = trimmed.search(/[\[{]/);
  if (firstBrace === -1) return null;
  const lastBrace = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
  if (lastBrace <= firstBrace) return null;
  return trimmed.slice(firstBrace, lastBrace + 1);
};

const parseJsonCandidate = (value: string) => {
  const trimmed = value.trim();
  const candidates = [
    trimmed,
    normalizeEscapes(trimmed),
    extractJsonCandidate(trimmed),
    extractJsonCandidate(normalizeEscapes(trimmed)),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      return {
        parsed,
        formatted: JSON.stringify(parsed, null, 2),
      };
    } catch {
      // continue
    }
  }

  return {
    parsed: null,
    formatted: normalizeEscapes(trimmed),
  };
};

function splitPythonSegments(formatted: string): PythonSegment[] {
  const lines = formatted.split("\n");
  const segments: PythonSegment[] = [];
  let textBuffer: string[] = [];
  let pythonBuffer: string[] = [];
  let pythonEndMarker: string | null = null;

  const flushText = () => {
    if (textBuffer.length === 0) return;
    segments.push({ type: "text", content: textBuffer.join("\n") });
    textBuffer = [];
  };

  const flushPython = () => {
    if (pythonBuffer.length === 0) return;
    segments.push({ type: "python", content: pythonBuffer.join("\n") });
    pythonBuffer = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (!pythonEndMarker) {
      const match = line.match(PYTHON_HEREDOC_START);
      if (match) {
        const marker = match[1];
        const hasClosingMarker = lines
          .slice(i + 1)
          .some((nextLine) => nextLine.trim() === marker);
        if (hasClosingMarker) {
          textBuffer.push(line);
          flushText();
          pythonEndMarker = marker;
          continue;
        }
      }
      const inlineCode = extractPythonDashC(line);
      if (inlineCode) {
        textBuffer.push(line);
        flushText();
        segments.push({ type: "python", content: inlineCode });
        continue;
      }
      textBuffer.push(line);
      continue;
    }

    if (line.trim() === pythonEndMarker) {
      flushPython();
      textBuffer.push(line);
      flushText();
      pythonEndMarker = null;
      continue;
    }
    pythonBuffer.push(line);
  }

  if (pythonEndMarker) {
    flushPython();
  }
  flushText();

  if (segments.length === 0) {
    return [{ type: "text", content: formatted }];
  }
  return segments;
}

function splitLiveOutputSegments(value: string): LiveOutputSegment[] {
  const formatted = formatLiveOutputText(value);
  const lines = formatted.split("\n");
  const segments: LiveOutputSegment[] = [];
  let buffer: string[] = [];
  let currentType: LiveOutputSegment["type"] = "text";

  const flush = () => {
    if (buffer.length === 0) return;
    segments.push({ type: currentType, content: buffer.join("\n") });
    buffer = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed) {
      if (TOOL_OUTPUT_MARKER.test(trimmed)) {
        flush();
        currentType = "tool_output";
        return;
      }
      if (CODE_LOGS_MARKER.test(trimmed)) {
        flush();
        currentType = "code_logs";
        return;
      }
      if (CODE_ERROR_MARKER.test(trimmed)) {
        flush();
        currentType = "code_error";
        return;
      }
      const codeMatch = trimmed.match(CODE_MARKER);
      if (codeMatch) {
        const statusText = (codeMatch[1] || "").trim();
        if (statusText) {
          flush();
          segments.push({ type: "code_status", content: statusText });
          currentType = "text";
          return;
        }
        flush();
        currentType = "code";
        return;
      }
    }
    buffer.push(line);
  });

  flush();
  return segments;
}

function LazySyntaxHighlighter({
  value,
  language,
  className,
  ...props
}: {
  value: string;
  language?: string;
  className?: string;
  [key: string]: any;
}) {
  const [SyntaxHighlighter, setSyntaxHighlighter] =
    useState<React.ComponentType<any> | null>(null);
  const [style, setStyle] = useState<unknown | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      import("react-syntax-highlighter"),
      import("react-syntax-highlighter/dist/esm/styles/prism"),
    ])
      .then(([syntaxModule, styleModule]) => {
        if (!active) return;
        setSyntaxHighlighter(() => syntaxModule.Prism);
        setStyle(styleModule.vscDarkPlus);
      })
      .catch(() => {
        if (active) {
          setSyntaxHighlighter(null);
          setStyle(null);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (!SyntaxHighlighter || !style) {
    return (
      <pre className={className ?? "whitespace-pre-wrap break-words"}>
        {value}
      </pre>
    );
  }

  return (
    <SyntaxHighlighter language={language} style={style} className={className} {...props}>
      {value}
    </SyntaxHighlighter>
  );
}

export const LiveOutputRenderer = forwardRef<
  HTMLDivElement,
  {
    value: string;
    className?: string;
    textClassName?: string;
    ariaLive?: "polite" | "assertive" | "off";
  }
>(({ value, className, textClassName, ariaLive }, ref) => {
  const segments = useMemo(() => splitLiveOutputSegments(value), [value]);
  const containerClassName = className ? `${className} space-y-2` : "space-y-2";
  const textSegmentClass = textClassName ?? "m-0 whitespace-pre-wrap break-words";

  const renderTextContent = (content: string, keyPrefix: string) =>
    splitPythonSegments(content).map((segment, index) =>
      segment.type === "python" ? (
        <LazySyntaxHighlighter
          key={`${keyPrefix}-python-${index}`}
          value={segment.content}
          language="python"
          wrapLongLines
          customStyle={{
            margin: 0,
            padding: "12px",
            borderRadius: "8px",
            lineHeight: "1.6",
            background: "transparent",
          }}
          codeTagProps={{
            style: {
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            },
          }}
        />
      ) : (
        <pre key={`${keyPrefix}-text-${index}`} className={textSegmentClass}>
          {segment.content}
        </pre>
      ),
    );

  return (
    <div ref={ref} className={containerClassName} aria-live={ariaLive}>
      {segments.map((segment, index) => {
        if (segment.type === "code_status") {
          return (
            <div
              key={`code-status-${index}`}
              className="inline-flex items-center gap-2 rounded-md border border-slate-700/60 bg-black/30 px-3 py-1.5 text-[11px] text-slate-300"
            >
              <FiTerminal className="h-3.5 w-3.5 text-slate-400" />
              Code interpreter {segment.content}
            </div>
          );
        }

        if (segment.type === "code") {
          if (!segment.content.trim()) return null;
          return (
            <div
              key={`code-${index}`}
              className="rounded-lg border border-sky-500/30 bg-sky-500/5"
            >
              <div className="flex items-center gap-2 px-3 pt-2 text-[10px] uppercase tracking-wide text-sky-200">
                <FiCode className="h-3.5 w-3.5" />
                Code interpreter
              </div>
              <div className="px-3 pb-3 pt-2">
                <LazySyntaxHighlighter
                  value={segment.content}
                  language="python"
                  wrapLongLines
                  customStyle={{
                    margin: 0,
                    padding: "12px",
                    borderRadius: "8px",
                    lineHeight: "1.6",
                    background: "transparent",
                  }}
                  codeTagProps={{
                    style: {
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    },
                  }}
                />
              </div>
            </div>
          );
        }

        if (segment.type === "code_logs") {
          if (!segment.content.trim()) return null;
          const { parsed, formatted } = parseJsonCandidate(segment.content);
          return (
            <div
              key={`code-logs-${index}`}
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/5"
            >
              <div className="flex items-center gap-2 px-3 pt-2 text-[10px] uppercase tracking-wide text-emerald-200">
                <FiTerminal className="h-3.5 w-3.5" />
                Code interpreter logs
              </div>
              <div className="px-3 pb-3 pt-2">
                {parsed ? (
                  <LazySyntaxHighlighter
                    value={formatted}
                    language="json"
                    wrapLongLines
                    customStyle={{
                      margin: 0,
                      padding: "12px",
                      borderRadius: "8px",
                      lineHeight: "1.6",
                      background: "transparent",
                    }}
                    codeTagProps={{
                      style: {
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      },
                    }}
                  />
                ) : (
                  <pre className={textSegmentClass}>{formatted}</pre>
                )}
              </div>
            </div>
          );
        }

        if (segment.type === "code_error") {
          if (!segment.content.trim()) return null;
          return (
            <div
              key={`code-error-${index}`}
              className="rounded-lg border border-rose-500/40 bg-rose-500/10"
            >
              <div className="flex items-center gap-2 px-3 pt-2 text-[10px] uppercase tracking-wide text-rose-200">
                <FiAlertTriangle className="h-3.5 w-3.5" />
                Code interpreter error
              </div>
              <div className="px-3 pb-3 pt-2">
                <pre className="m-0 whitespace-pre-wrap break-words text-rose-100">
                  {normalizeEscapes(segment.content)}
                </pre>
              </div>
            </div>
          );
        }

        if (segment.type === "tool_output") {
          if (!segment.content.trim()) return null;
          return (
            <div
              key={`tool-output-${index}`}
              className="rounded-lg border border-slate-700/60 bg-black/30"
            >
              <div className="flex items-center gap-2 px-3 pt-2 text-[10px] uppercase tracking-wide text-slate-300">
                <FiTerminal className="h-3.5 w-3.5" />
                Tool output
              </div>
              <div className="px-3 pb-3 pt-2 space-y-2">
                {renderTextContent(segment.content, `tool-${index}`)}
              </div>
            </div>
          );
        }

        if (!segment.content.trim()) return null;
        return (
          <div key={`text-${index}`} className="space-y-2">
            {renderTextContent(segment.content, `text-${index}`)}
          </div>
        );
      })}
    </div>
  );
});

LiveOutputRenderer.displayName = "LiveOutputRenderer";
