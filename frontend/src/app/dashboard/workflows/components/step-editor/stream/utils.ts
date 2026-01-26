import {
  buildHtmlSrcDoc,
  formatLogMessage,
  looksLikeHtml,
} from "../LogFormatter";

export interface LogEntry {
  timestamp: number;
  message: string;
  level: string;
  type: string;
}

export const OUTPUT_DELTA_PREFIX = "__OUTPUT_DELTA__";

export type LogLevelFilter = "all" | "info" | "warn" | "error";

export const formatTimestamp = (timestamp: number) =>
  new Date(timestamp * 1000).toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

export const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0s";
  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${remainingSeconds}s`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
};

export const formatElapsed = (ms: number) =>
  formatDuration(Math.floor(Math.max(0, ms) / 1000));

const ERROR_TOKENS = [
  "error",
  "failed",
  "exception",
  "traceback",
  "fatal",
  "panic",
  "stderr",
];
const WARN_TOKENS = ["warn", "warning", "⚠️"];

export const getLogLevelBucket = (
  log: Pick<LogEntry, "level" | "message">,
): Exclude<LogLevelFilter, "all"> => {
  const levelText = (log.level || "").toLowerCase();
  const messageText = (log.message || "").toLowerCase();

  if (ERROR_TOKENS.some((token) => messageText.includes(token))) return "error";
  if (WARN_TOKENS.some((token) => messageText.includes(token))) return "warn";
  if (levelText.includes("error")) return "error";
  if (levelText.includes("warn")) return "warn";
  return "info";
};

export const matchesLevel = (log: LogEntry, filterLevel: LogLevelFilter) => {
  if (filterLevel === "all") return true;
  return getLogLevelBucket(log) === filterLevel;
};

export const matchesSearch = (log: LogEntry, query: string) => {
  const timestamp = formatTimestamp(log.timestamp).toLowerCase();
  return (
    log.message.toLowerCase().includes(query) ||
    log.level.toLowerCase().includes(query) ||
    timestamp.includes(query)
  );
};

export const formatLogLine = (log: LogEntry) =>
  `[${formatTimestamp(log.timestamp)}] [${getLogLevelBucket(log).toUpperCase()}] ${log.message}`;

export const stripShellPrefix = (message: string) => {
  if (
    message.startsWith("💻") ||
    message.startsWith("📤") ||
    message.startsWith("⚠️")
  ) {
    return message.substring(2).trim();
  }
  return message;
};

export const extractHtmlFromMessage = (message: string) => {
  const trimmed = message.trim();
  const htmlMatch = trimmed.match(/```html\s*([\s\S]*?)\s*```/i);
  if (htmlMatch?.[1]) return htmlMatch[1].trim();
  const genericMatch = trimmed.match(/```\s*([\s\S]*?)\s*```/);
  if (genericMatch?.[1]) {
    const inner = genericMatch[1].trim();
    if (looksLikeHtml(inner)) return inner;
  }
  if (looksLikeHtml(trimmed)) return trimmed;
  return null;
};

export { buildHtmlSrcDoc, formatLogMessage, looksLikeHtml };
