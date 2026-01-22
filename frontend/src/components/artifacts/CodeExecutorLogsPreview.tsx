import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { FiCode, FiCopy, FiImage, FiTerminal } from "react-icons/fi";
import { JsonViewer } from "@/components/ui/JsonViewer";

const MAX_OUTPUT_PREVIEW_LINES = 16;
const MAX_OUTPUT_PREVIEW_CHARS = 1600;

interface CodeExecutorOutputItem {
  type?: string;
  logs?: string;
  error?: string;
  image_url?: string;
  data?: string;
}

interface CodeExecutorCallLog {
  call_id?: string;
  status?: string;
  code?: string;
  tool_name?: string | null;
  outputs?: CodeExecutorOutputItem[];
}

export interface CodeExecutorLogsPayload {
  job_id?: string;
  tenant_id?: string;
  step_index?: number;
  step_order?: number;
  step_name?: string;
  model?: string;
  logs?: CodeExecutorCallLog[];
}

export type CodeExecutorLogsPreviewVariant = "compact" | "default";

export const isCodeExecutorLogsPayload = (
  value: unknown,
): value is CodeExecutorLogsPayload => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.logs)) return false;
  if (record.job_id && typeof record.job_id !== "string") return false;
  const hasStepMeta =
    typeof record.step_name === "string" ||
    typeof record.step_order === "number" ||
    typeof record.step_index === "number" ||
    typeof record.job_id === "string";
  if (!hasStepMeta) return false;
  if (record.logs.length === 0) return true;
  return record.logs.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const entryRecord = entry as Record<string, unknown>;
    return (
      typeof entryRecord.code === "string" ||
      Array.isArray(entryRecord.outputs)
    );
  });
};

function extractJsonFromCodeBlock(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return trimmed;
}

function parseNestedJsonString(value: string, maxDepth = 2): unknown | null {
  let current: unknown = value;
  let parsedAtLeastOnce = false;

  for (let depth = 0; depth < maxDepth; depth += 1) {
    if (typeof current !== "string") break;
    const trimmed = extractJsonFromCodeBlock(current).trim();
    if (!trimmed) break;

    try {
      current = JSON.parse(trimmed);
      parsedAtLeastOnce = true;
    } catch {
      break;
    }
  }

  return parsedAtLeastOnce ? current : null;
}

const getOutputPreview = (value: string) => {
  const normalized = value.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const truncatedByLines = lines.length > MAX_OUTPUT_PREVIEW_LINES;
  const linePreview = truncatedByLines
    ? lines.slice(0, MAX_OUTPUT_PREVIEW_LINES).join("\n")
    : normalized;
  const truncatedByChars = linePreview.length > MAX_OUTPUT_PREVIEW_CHARS;
  const preview = truncatedByChars
    ? linePreview.slice(0, MAX_OUTPUT_PREVIEW_CHARS)
    : linePreview;
  return {
    preview,
    isTruncated: truncatedByLines || truncatedByChars,
    totalLines: lines.length,
  };
};

const formatStepLabel = (payload: CodeExecutorLogsPayload) => {
  if (payload.step_order !== undefined) {
    const nameSuffix = payload.step_name ? ` · ${payload.step_name}` : "";
    return `Step ${payload.step_order}${nameSuffix}`;
  }
  return payload.step_name || "Code executor logs";
};

const getStatusTone = (status?: string) => {
  const normalized = status?.toLowerCase() ?? "";
  if (!normalized) {
    return {
      label: "unknown",
      className: "bg-white/10 text-slate-200",
    };
  }
  if (normalized.includes("complete") || normalized.includes("success")) {
    return {
      label: status ?? "completed",
      className: "bg-emerald-500/20 text-emerald-200",
    };
  }
  if (normalized.includes("error") || normalized.includes("fail")) {
    return {
      label: status ?? "error",
      className: "bg-rose-500/20 text-rose-200",
    };
  }
  if (normalized.includes("run") || normalized.includes("progress")) {
    return {
      label: status ?? "running",
      className: "bg-amber-500/20 text-amber-200",
    };
  }
  return {
    label: status ?? "unknown",
    className: "bg-white/10 text-slate-200",
  };
};

const formatJsonCandidate = (value: string) => {
  const parsed = parseNestedJsonString(value);
  if (parsed && typeof parsed !== "string") {
    try {
      return {
        parsed,
        formatted: JSON.stringify(parsed, null, 2),
      };
    } catch {
      return { parsed: null, formatted: value };
    }
  }
  return { parsed: null, formatted: value };
};

export function CodeExecutorLogsPreview({
  payload,
  variant = "default",
}: {
  payload: CodeExecutorLogsPayload;
  variant?: CodeExecutorLogsPreviewVariant;
}) {
  const logs = Array.isArray(payload.logs) ? payload.logs : [];
  const stepLabel = formatStepLabel(payload);
  const isCompact = variant === "compact";

  const [expandedOutputs, setExpandedOutputs] = useState<Set<string>>(
    () => new Set(),
  );

  const toggleExpandedOutput = useCallback((outputKey: string) => {
    setExpandedOutputs((prev) => {
      const next = new Set(prev);
      if (next.has(outputKey)) {
        next.delete(outputKey);
      } else {
        next.add(outputKey);
      }
      return next;
    });
  }, []);

  const handleCopyText = useCallback(async (value: string, label: string) => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        throw new Error("Clipboard API not available");
      }
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}`);
    }
  }, []);

  const renderTextOutput = ({
    label,
    value,
    outputKey,
    headerClass,
    borderClass,
    textClass,
    allowJson,
  }: {
    label: string;
    value: string;
    outputKey: string;
    headerClass: string;
    borderClass: string;
    textClass: string;
    allowJson?: boolean;
  }) => {
    const { parsed, formatted } = allowJson ? formatJsonCandidate(value) : { parsed: null, formatted: value };
    const { preview, isTruncated } = getOutputPreview(formatted);
    const isExpanded = expandedOutputs.has(outputKey);
    const displayValue = isExpanded ? formatted : preview;
    const showJsonViewer = parsed && !isCompact;

    return (
      <div className={`rounded-md border ${borderClass} bg-black/30`}>
        <div
          className={`flex items-center justify-between px-3 pt-2 text-[10px] uppercase tracking-wide ${headerClass}`}
        >
          <div className="flex items-center gap-2">
            <span>{label}</span>
            {allowJson && parsed && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-slate-300">
                json
              </span>
            )}
            {isTruncated && !isExpanded && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-slate-400">
                truncated
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleCopyText(formatted, label)}
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
        <div className="px-3 pb-2 pt-2">
          {showJsonViewer ? (
            <JsonViewer
              value={parsed}
              raw={formatted}
              defaultMode="tree"
              defaultExpandedDepth={2}
              className="text-xs"
            />
          ) : (
            <pre className={`whitespace-pre-wrap break-words text-[11px] ${textClass}`}>
              {displayValue}
            </pre>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`h-full w-full overflow-y-auto rounded-md bg-[#0d1117] text-xs text-slate-200 ${
        isCompact ? "scrollbar-hide-until-hover" : ""
      }`}
    >
      <div
        className={`sticky top-0 z-10 border-b border-white/10 bg-[#161b22] ${
          isCompact ? "px-3 py-2" : "px-4 py-3"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-300">
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-100">
            Code executor logs
          </span>
          <span className="text-[11px] font-semibold text-slate-100">
            {stepLabel}
          </span>
          {payload.model && (
            <span className="rounded-full bg-white/10 px-2 py-0.5">
              {payload.model}
            </span>
          )}
          {payload.job_id && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono">
              {payload.job_id}
            </span>
          )}
          <span className="rounded-full bg-white/10 px-2 py-0.5">
            {logs.length} call{logs.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="px-4 py-10 text-center text-[11px] text-slate-400">
          No code executor logs recorded for this step.
        </div>
      ) : (
        <div className={`space-y-4 ${isCompact ? "px-3 py-3" : "px-4 py-4"}`}>
          {logs.map((log, logIndex) => {
            const callKey = log.call_id ? `call-${log.call_id}` : `call-${logIndex}`;
            const outputs = Array.isArray(log.outputs) ? log.outputs : [];
            const statusTone = getStatusTone(log.status);

            return (
              <div
                key={callKey}
                className="rounded-md border border-white/10 bg-black/30"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-[10px] text-slate-400">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-100">
                      Call {logIndex + 1}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 ${statusTone.className}`}>
                      {statusTone.label}
                    </span>
                    <span className="rounded-full bg-white/5 px-2 py-0.5">
                      {outputs.length} output{outputs.length === 1 ? "" : "s"}
                    </span>
                    {log.tool_name && (
                      <span className="rounded-full bg-white/5 px-2 py-0.5">
                        {log.tool_name}
                      </span>
                    )}
                  </div>
                  {log.call_id && <div className="font-mono">{log.call_id}</div>}
                </div>

                {log.code && (
                  <div className="border-b border-white/10 px-3 py-3">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400">
                      <div className="flex items-center gap-2">
                        <FiCode className="h-3 w-3 text-slate-400" />
                        Code
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText(log.code ?? "", "Code")}
                        className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
                        aria-label="Copy code"
                      >
                        <FiCopy className="h-3 w-3" />
                        Copy
                      </button>
                    </div>
                    <pre className="mt-2 rounded-md border border-white/10 bg-black/40 p-3 text-[11px] text-slate-100 overflow-x-auto whitespace-pre">
                      {log.code}
                    </pre>
                  </div>
                )}

                <div className="space-y-3 px-3 py-3">
                  {outputs.length === 0 ? (
                    <div className="rounded-md border border-white/10 bg-black/40 px-3 py-3 text-[10px] text-slate-500">
                      No outputs captured for this call.
                    </div>
                  ) : (
                    outputs.map((output, outputIndex) => {
                      const rawType = output.type?.toLowerCase() ?? "";
                      const outputKey = `${callKey}-output-${outputIndex}`;

                      if (rawType === "logs" || output.logs) {
                        return renderTextOutput({
                          label: "Logs",
                          value: output.logs ?? "",
                          outputKey,
                          headerClass: "text-emerald-300",
                          borderClass: "border-emerald-500/20",
                          textClass: "text-slate-100",
                          allowJson: true,
                        });
                      }

                      if (rawType === "error" || output.error) {
                        return renderTextOutput({
                          label: "Error",
                          value: output.error ?? "",
                          outputKey,
                          headerClass: "text-rose-300",
                          borderClass: "border-rose-500/30",
                          textClass: "text-rose-100",
                        });
                      }

                      if (rawType === "image" || output.image_url) {
                        const imageUrl = output.image_url ?? "";
                        return (
                          <div
                            key={outputKey}
                            className="rounded-md border border-sky-500/30 bg-black/30"
                          >
                            <div className="flex items-center justify-between px-3 pt-2 text-[10px] uppercase tracking-wide text-sky-300">
                              <div className="flex items-center gap-2">
                                <FiImage className="h-3 w-3" />
                                Image
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopyText(imageUrl, "Image URL")}
                                className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
                                aria-label="Copy image URL"
                              >
                                Copy
                              </button>
                            </div>
                            <div className="px-3 pb-3 pt-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imageUrl}
                                alt="Code executor output"
                                className="max-h-48 rounded-md border border-white/10 object-contain"
                              />
                              <a
                                href={imageUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex items-center gap-1 text-[10px] text-sky-300 hover:text-sky-200"
                              >
                                View full image
                              </a>
                            </div>
                          </div>
                        );
                      }

                      if (output.data) {
                        return renderTextOutput({
                          label: output.type ? output.type : "Output",
                          value: output.data,
                          outputKey,
                          headerClass: "text-slate-300",
                          borderClass: "border-white/10",
                          textClass: "text-slate-100",
                          allowJson: true,
                        });
                      }

                      return (
                        <div
                          key={outputKey}
                          className="rounded-md border border-white/10 bg-black/30 px-3 py-3 text-[10px] text-slate-500"
                        >
                          <div className="flex items-center gap-2">
                            <FiTerminal className="h-3 w-3" />
                            Output is empty or not captured.
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
