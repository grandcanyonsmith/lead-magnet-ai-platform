import React, { useEffect, useMemo, useState } from "react";
import { LazySyntaxHighlighter } from "./LazySyntaxHighlighter";
import {
  FilteredCommandEntry,
  splitShellCommandSegments,
  getOutputPreview,
} from "./utils";
import { highlightMatches } from "./LogUtils";

interface LogLineRendererProps {
  entryCommand: FilteredCommandEntry;
  callKey: string;
  showStdout: boolean;
  showStderr: boolean;
  hasQuery: boolean;
  trimmedQuery: string;
  expandedOutputs: Set<string>;
  toggleExpandedOutput: (key: string) => void;
  handleCopyText: (value: string, label: string) => void;
}

interface GeneratedCommandFileCardProps {
  fileName: string;
  content: string;
  contentType: string;
  hasQuery: boolean;
  trimmedQuery: string;
  handleCopyText: (value: string, label: string) => void;
}

const actionButtonClassName =
  "rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60";

function GeneratedCommandFileCard({
  fileName,
  content,
  contentType,
  hasQuery,
  trimmedQuery,
  handleCopyText,
}: GeneratedCommandFileCardProps) {
  const [showSource, setShowSource] = useState(false);
  const resolvedContentType = contentType || "text/plain";
  const isHtmlPreview =
    resolvedContentType === "text/html" ||
    resolvedContentType === "image/svg+xml";
  const { preview, isTruncated } = useMemo(() => getOutputPreview(content), [content]);
  const displaySource = showSource ? content : preview;
  const displayContent = hasQuery
    ? highlightMatches(displaySource, trimmedQuery)
    : displaySource;
  const canToggleSource = isHtmlPreview || isTruncated;
  const shouldRenderSource = !isHtmlPreview || showSource || hasQuery;
  const sourceToggleLabel = isHtmlPreview
    ? showSource
      ? "Hide source"
      : "Show source"
    : showSource
      ? "Show less"
      : "Show more";
  const objectUrl = useMemo(() => {
    if (
      typeof window === "undefined" ||
      typeof URL === "undefined" ||
      typeof URL.createObjectURL !== "function"
    ) {
      return null;
    }
    const blob = new Blob([content], { type: resolvedContentType });
    return URL.createObjectURL(blob);
  }, [content, resolvedContentType]);

  useEffect(() => {
    if (hasQuery) {
      setShowSource(true);
    }
  }, [hasQuery]);

  useEffect(() => {
    return () => {
      if (objectUrl && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  return (
    <div className="rounded-md border border-sky-500/20 bg-sky-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[10px] text-slate-300">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="rounded-full bg-sky-400/15 px-2 py-0.5 font-semibold text-sky-200">
            Generated file
          </span>
          <span className="max-w-full truncate font-mono text-slate-100">
            {fileName}
          </span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-400">
            {resolvedContentType}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => handleCopyText(content, `${fileName} source`)}
            className={actionButtonClassName}
          >
            Copy source
          </button>
          {objectUrl && (
            <a
              href={objectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={actionButtonClassName}
            >
              Open
            </a>
          )}
          {objectUrl && (
            <a
              href={objectUrl}
              download={fileName}
              className={actionButtonClassName}
            >
              Download
            </a>
          )}
          {canToggleSource && (
            <button
              type="button"
              onClick={() => setShowSource((current) => !current)}
              className={actionButtonClassName}
            >
              {sourceToggleLabel}
            </button>
          )}
        </div>
      </div>

      {isHtmlPreview && objectUrl && (
        <div className="border-t border-sky-500/20 bg-white">
          <iframe
            src={objectUrl}
            title={`${fileName} preview`}
            className="h-56 w-full border-0"
            sandbox="allow-scripts allow-forms allow-popups"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {shouldRenderSource && (
        <pre className="m-0 whitespace-pre-wrap break-words border-t border-sky-500/20 px-3 py-2 font-mono text-[11px] text-slate-100">
          {displayContent}
        </pre>
      )}
    </div>
  );
}

export const LogLineRenderer: React.FC<LogLineRendererProps> = ({
  entryCommand,
  callKey,
  showStdout,
  showStderr,
  hasQuery,
  trimmedQuery,
  expandedOutputs,
  toggleExpandedOutput,
  handleCopyText,
}) => {
  const output = entryCommand.output;
  const hasStdout = Boolean(output?.stdout?.trim());
  const hasStderr = Boolean(output?.stderr?.trim());
  const outputsHidden = !showStdout && !showStderr;
  const outcomeLabel = entryCommand.outcomeLabel;
  const isErrorExit =
    output?.outcome?.type === "exit" &&
    typeof output?.outcome?.exit_code === "number" &&
    output?.outcome?.exit_code !== 0;
  const commandKey = `${callKey}-${entryCommand.index}`;

  const renderCommandSegments = (command: string) => {
    const segments = splitShellCommandSegments(command);
    const renderShell = (content: string, key: string) => (
      <pre
        key={key}
        className="m-0 whitespace-pre-wrap break-words font-mono text-[11px] text-slate-100"
      >
        {hasQuery ? highlightMatches(content, trimmedQuery) : content}
      </pre>
    );

    if (segments.length === 1 && segments[0]?.type === "shell") {
      return renderShell(segments[0].content, "shell");
    }

    return (
      <div className="space-y-2">
        {segments.map((segment, index) =>
          segment.type === "python" ? (
            <LazySyntaxHighlighter
              key={`python-${index}`}
              value={segment.content}
              language="python"
              wrapLongLines
              className="rounded-md border border-sky-500/20 bg-black/30 text-[11px]"
              customStyle={{
                margin: 0,
                padding: "8px 10px",
                background: "transparent",
                lineHeight: "1.6",
              }}
              codeTagProps={{
                style: {
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                },
              }}
            />
          ) : segment.type === "file" ? (
            <GeneratedCommandFileCard
              key={`file-${segment.fileName}-${index}`}
              fileName={segment.fileName}
              content={segment.content}
              contentType={segment.contentType}
              hasQuery={hasQuery}
              trimmedQuery={trimmedQuery}
              handleCopyText={handleCopyText}
            />
          ) : (
            renderShell(segment.content, `shell-${index}`)
          )
        )}
      </div>
    );
  };

  const renderOutputSection = (
    label: "stdout" | "stderr",
    value: string,
    outputKey: string,
    headerClass: string,
    textClass: string
  ) => {
    const { preview, isTruncated } = getOutputPreview(value);
    const isExpanded = expandedOutputs.has(outputKey);
    const displayValue = isExpanded ? value : preview;
    const displayContent = hasQuery
      ? highlightMatches(displayValue, trimmedQuery)
      : displayValue;

    return (
      <div className="border-t border-white/10">
        <div
          className={`flex items-center justify-between px-3 pt-2 text-[10px] uppercase tracking-wide ${headerClass}`}
        >
          <div className="flex items-center gap-2">
            <span>{label}</span>
            {isTruncated && !isExpanded && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-slate-400">
                truncated
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleCopyText(value, label)}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
              aria-label={`Copy ${label}`}
            >
              Copy
            </button>
            {isTruncated && (
              <button
                type="button"
                onClick={() => toggleExpandedOutput(outputKey)}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${label}`}
              >
                {isExpanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        </div>
        <pre
          className={`px-3 pb-2 whitespace-pre-wrap break-words text-[11px] ${textClass}`}
        >
          {displayContent}
        </pre>
      </div>
    );
  };

  return (
    <div className="rounded-md border border-white/10 bg-black/40">
      <div className="flex items-start justify-between gap-2 px-3 py-2 text-[11px] text-slate-100">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <span className="text-slate-500">$</span>
          <div className="min-w-0 flex-1">
            {renderCommandSegments(entryCommand.command)}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleCopyText(entryCommand.command, "Command")}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
            aria-label="Copy command"
          >
            Copy
          </button>
          {entryCommand.isError && (
            <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[9px] text-rose-200">
              error
            </span>
          )}
        </div>
      </div>

      {outcomeLabel && (
        <div className="border-t border-white/10 px-3 py-1.5 text-[10px] text-slate-400">
          Outcome:{" "}
          <span
            className={`rounded-full px-2 py-0.5 ${
              isErrorExit
                ? "bg-rose-500/20 text-rose-200"
                : "bg-emerald-500/20 text-emerald-200"
            }`}
          >
            {outcomeLabel}
          </span>
        </div>
      )}

      {outputsHidden && (hasStdout || hasStderr) && (
        <div className="border-t border-white/10 px-3 py-2 text-[10px] text-slate-500">
          Output hidden by filters.
        </div>
      )}

      {showStdout &&
        hasStdout &&
        renderOutputSection(
          "stdout",
          output?.stdout ?? "",
          `${commandKey}-stdout`,
          "text-emerald-300",
          "text-slate-100"
        )}

      {showStderr &&
        hasStderr &&
        renderOutputSection(
          "stderr",
          output?.stderr ?? "",
          `${commandKey}-stderr`,
          "text-rose-300",
          "text-rose-100"
        )}

      {!hasStdout && !hasStderr && !outcomeLabel && (
        <div className="border-t border-white/10 px-3 py-2 text-[10px] text-slate-500">
          No output captured for this command.
        </div>
      )}
    </div>
  );
};
