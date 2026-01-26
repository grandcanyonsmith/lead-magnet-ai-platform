export const LARGE_COMMAND_THRESHOLD = 12;
export const LARGE_CALL_THRESHOLD = 4;
export const MAX_OUTPUT_PREVIEW_LINES = 14;
export const MAX_OUTPUT_PREVIEW_CHARS = 1200;
export const PYTHON_HEREDOC_START =
  /^\s*\$?\s*python(?:\d+(?:\.\d+)?)?(?:\s|$).*<<\s*['"]?([A-Za-z0-9_]+)['"]?/i;
export const PYTHON_DASH_C = /^\s*\$?\s*python(?:\d+(?:\.\d+)?)?\s+-c\s+/i;

export interface ShellExecutorOutcome {
  type?: string;
  exit_code?: number;
  message?: string;
}

export interface ShellExecutorOutputItem {
  stdout?: string;
  stderr?: string;
  outcome?: ShellExecutorOutcome;
}

export interface ShellExecutorCallLog {
  call_id?: string;
  commands?: string[];
  timeout_ms?: number;
  max_output_length?: number;
  output?: ShellExecutorOutputItem[];
  meta?: {
    runner?: string;
    duration_ms?: number;
  };
  workspace_id?: string;
  reset_workspace?: boolean;
  timestamp?: number;
}

export interface ShellExecutorLogsPayload {
  job_id?: string;
  tenant_id?: string;
  step_index?: number;
  step_order?: number;
  step_name?: string;
  model?: string;
  logs?: ShellExecutorCallLog[];
}

export type ShellExecutorLogsPreviewVariant = "compact" | "default";

export interface FilteredCommandEntry {
  command: string;
  output?: ShellExecutorOutputItem;
  outcomeLabel: string | null;
  isError: boolean;
  matches: boolean;
  index: number;
}

export interface FilteredLogEntry {
  log: ShellExecutorCallLog;
  logIndex: number;
  commands: FilteredCommandEntry[];
  totalCommands: number;
  errorCount: number;
  matchedCount: number;
}

export type ShellCommandSegment = { type: "shell" | "python"; content: string };

export const EMPTY_LOGS: ShellExecutorCallLog[] = [];

export const isShellExecutorLogsPayload = (
  value: unknown,
): value is ShellExecutorLogsPayload => {
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
    return Array.isArray(entryRecord.commands) || Array.isArray(entryRecord.output);
  });
};

export const formatDuration = (durationMs?: number) => {
  if (durationMs === undefined || durationMs === null) return null;
  if (durationMs < 1000) return `${durationMs}ms`;
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}m ${remaining}s`;
};

export const formatTimestamp = (timestamp?: number) => {
  if (!timestamp) return null;
  const asMs = timestamp > 1e12 ? timestamp : timestamp * 1000;
  return new Date(asMs).toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export const formatOutcome = (outcome?: ShellExecutorOutcome) => {
  if (!outcome) return null;
  if (outcome.type === "exit") {
    return `exit ${outcome.exit_code ?? 0}`;
  }
  if (outcome.type) return outcome.type;
  return null;
};

export const normalizeEscapes = (value: string) =>
  value
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");

export const extractPythonDashC = (line: string): string | null => {
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

export const splitShellCommandSegments = (command: string): ShellCommandSegment[] => {
  const normalized = command.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const segments: ShellCommandSegment[] = [];
  let shellBuffer: string[] = [];
  let pythonBuffer: string[] = [];
  let pythonEndMarker: string | null = null;

  const flushShell = () => {
    if (shellBuffer.length === 0) return;
    segments.push({ type: "shell", content: shellBuffer.join("\n") });
    shellBuffer = [];
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
          shellBuffer.push(line);
          flushShell();
          pythonEndMarker = marker;
          continue;
        }
      }
      const inlineCode = extractPythonDashC(line);
      if (inlineCode) {
        shellBuffer.push(line);
        flushShell();
        segments.push({ type: "python", content: inlineCode });
        continue;
      }
      shellBuffer.push(line);
      continue;
    }

    if (line.trim() === pythonEndMarker) {
      flushPython();
      shellBuffer.push(line);
      flushShell();
      pythonEndMarker = null;
      continue;
    }
    pythonBuffer.push(line);
  }

  if (pythonEndMarker) {
    flushPython();
  }
  flushShell();

  if (segments.length === 0) {
    return [{ type: "shell", content: normalized }];
  }
  return segments;
};

export const isErrorOutput = (output?: ShellExecutorOutputItem) => {
  if (!output) return false;
  const exitCode = output.outcome?.exit_code;
  const isExitError =
    output.outcome?.type === "exit" &&
    typeof exitCode === "number" &&
    exitCode !== 0;
  const hasStderr = Boolean(output.stderr?.trim());
  return isExitError || hasStderr;
};

export const matchesSearch = (
  queryLower: string,
  ...values: Array<string | null | undefined>
) => {
  if (!queryLower) return true;
  return values.some((value) => value?.toLowerCase().includes(queryLower));
};

export const getOutputPreview = (value: string) => {
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

export const getStepLabel = (payload: ShellExecutorLogsPayload) => {
  if (payload.step_order !== undefined) {
    const nameSuffix = payload.step_name ? ` · ${payload.step_name}` : "";
    return `Step ${payload.step_order}${nameSuffix}`;
  }
  return payload.step_name || "Executor logs";
};

export const getExecutorLabel = (payload: ShellExecutorLogsPayload) => {
  const runner = payload.logs?.[0]?.meta?.runner?.toLowerCase() || "";
  if (runner.includes("code")) return "Code executor logs";
  if (runner.includes("shell")) return "Shell executor logs";
  return "Executor logs";
};

export const formatLogsAsText = (payload: ShellExecutorLogsPayload) => {
  const logs = Array.isArray(payload.logs) ? payload.logs : EMPTY_LOGS;
  const lines: string[] = [];

  lines.push(`${getExecutorLabel(payload)} - ${getStepLabel(payload)}`);
  if (payload.model) lines.push(`Model: ${payload.model}`);
  if (payload.job_id) lines.push(`Job: ${payload.job_id}`);
  lines.push("");

  logs.forEach((log, logIndex) => {
    const callIdSuffix = log.call_id ? ` (${log.call_id})` : "";
    lines.push(`Call ${logIndex + 1}${callIdSuffix}`);
    const metaParts: string[] = [];
    if (log.meta?.runner) metaParts.push(`runner=${log.meta.runner}`);
    const durationLabel = formatDuration(log.meta?.duration_ms);
    if (durationLabel) metaParts.push(`duration=${durationLabel}`);
    const timestampLabel = formatTimestamp(log.timestamp);
    if (timestampLabel) metaParts.push(`timestamp=${timestampLabel}`);
    if (log.timeout_ms) metaParts.push(`timeout=${log.timeout_ms}ms`);
    if (log.max_output_length) metaParts.push(`max_output=${log.max_output_length}`);
    if (log.workspace_id) metaParts.push(`workspace=${log.workspace_id}`);
    if (log.reset_workspace !== undefined) {
      metaParts.push(`reset_workspace=${log.reset_workspace ? "yes" : "no"}`);
    }
    if (metaParts.length > 0) lines.push(`Meta: ${metaParts.join(", ")}`);

    const commands = log.commands ?? [];
    const outputs = log.output ?? [];
    if (commands.length === 0) {
      lines.push("No commands recorded.");
      lines.push("");
      return;
    }

    commands.forEach((command, index) => {
      lines.push(`$ ${command}`);
      const output = outputs[index];
      const outcomeLabel = formatOutcome(output?.outcome);
      if (outcomeLabel) lines.push(`Outcome: ${outcomeLabel}`);
      if (output?.stdout) lines.push(`stdout:\n${output.stdout}`);
      if (output?.stderr) lines.push(`stderr:\n${output.stderr}`);
      lines.push("");
    });
  });

  return lines.join("\n");
};
