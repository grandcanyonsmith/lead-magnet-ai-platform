/**
 * Job formatting utilities
 */

import React from "react";
import { FiCheckCircle, FiXCircle, FiClock, FiLoader } from "react-icons/fi";
import { ExecutionStep } from "@/types/job";

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Queued",
    processing: "Generating",
    completed: "Ready",
    failed: "Error",
  };
  return labels[status] || status;
}

export function getStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <FiCheckCircle className="w-5 h-5 text-green-600" />;
    case "failed":
      return <FiXCircle className="w-5 h-5 text-red-600" />;
    case "processing":
      return <FiLoader className="w-5 h-5 text-blue-600 animate-spin" />;
    default:
      return <FiClock className="w-5 h-5 text-yellow-600" />;
  }
}

export function getStatusBadge(status: string) {
  const colors: Record<string, string> = {
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    processing: "bg-blue-100 text-blue-800",
    pending: "bg-yellow-100 text-yellow-800",
  };
  return (
    <span
      className={`px-3 py-1 text-sm font-medium rounded-full ${colors[status] || "bg-gray-100 text-gray-800"}`}
    >
      {getStatusLabel(status)}
    </span>
  );
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  // Check if date is invalid
  if (isNaN(date.getTime())) {
    return "Invalid date";
  }

  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // Handle negative values (date in future or clock skew)
  if (seconds < 0) {
    return "just now";
  }

  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

export function formatDurationSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

const PYTHON_INLINE_KEYWORDS = [
  "from",
  "import",
  "def",
  "class",
  "for",
  "if",
  "with",
  "try",
  "except",
  "elif",
  "else",
  "finally",
  "while",
  "return",
  "print",
  "assert",
  "raise",
  "pass",
];

const PYTHON_HEREDOC_REGEX =
  /(.*\bpython(?:\d+(?:\.\d+)?)?\b[^\n]*?<<\s*['"]?([A-Za-z0-9_]+)['"]?)(.*)/i;

const PYTHON_KEYWORD_REGEX = new RegExp(
  `\\s+(${PYTHON_INLINE_KEYWORDS.join("|")})\\b`,
  "g",
);

const formatShellPromptLines = (value: string): string => {
  const promptMatches = value.match(/\$\s/g);
  if (!promptMatches || promptMatches.length === 0) {
    return value;
  }
  const hasShellMarker = /shell execution/i.test(value);
  if (!hasShellMarker && promptMatches.length < 2) {
    return value;
  }
  return value.replace(/\s\$\s/g, "\n$ ");
};

const formatInlinePythonScript = (value: string): string => {
  let working = value.trim();
  if (!working) return "";
  working = working.replace(/;\s*/g, ";\n");
  working = working.replace(PYTHON_KEYWORD_REGEX, "\n$1");
  const lines = working
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.join("\n");
};

const splitInlineHeredoc = (
  rest: string,
  marker: string,
): { script: string; closingMarker: string | null; trailing: string | null } => {
  const trimmed = rest.trim();
  if (!trimmed) {
    return { script: "", closingMarker: null, trailing: null };
  }
  const rawMarker = ` ${marker}`;
  const lastIndex = trimmed.lastIndexOf(rawMarker);
  if (lastIndex === -1) {
    return { script: trimmed, closingMarker: null, trailing: null };
  }
  const afterIndex = lastIndex + rawMarker.length;
  const afterChar = trimmed[afterIndex];
  if (afterChar && !/\s/.test(afterChar)) {
    return { script: trimmed, closingMarker: null, trailing: null };
  }
  const script = trimmed.slice(0, lastIndex).trim();
  const trailing = trimmed.slice(afterIndex).trim();
  return {
    script,
    closingMarker: marker,
    trailing: trailing || null,
  };
};

const formatInlinePythonHeredocs = (value: string): string => {
  const lines = value.split("\n");
  const formatted: string[] = [];

  lines.forEach((line) => {
    const match = line.match(PYTHON_HEREDOC_REGEX);
    if (!match) {
      formatted.push(line);
      return;
    }
    const prefix = match[1];
    const marker = match[2];
    const rest = match[3] ?? "";
    if (!rest.trim()) {
      formatted.push(line);
      return;
    }

    const { script, closingMarker, trailing } = splitInlineHeredoc(rest, marker);
    formatted.push(prefix.trimEnd());
    if (script) {
      formatted.push(...formatInlinePythonScript(script).split("\n"));
    }
    if (closingMarker) {
      formatted.push(closingMarker);
    }
    if (trailing) {
      formatted.push(trailing);
    }
  });

  return formatted.join("\n");
};

export function formatLiveOutputText(value: string): string {
  if (!value) return value;
  const normalized = value.replace(/\r\n/g, "\n");
  const withShellBreaks = formatShellPromptLines(normalized);
  return formatInlinePythonHeredocs(withShellBreaks);
}

export function isJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

export function isMarkdown(str: string): boolean {
  if (typeof str !== "string") return false;
  // Check for common markdown patterns
  const markdownPatterns = [
    /^#{1,6}\s+.+/m, // Headers
    /\*\*.*?\*\*/, // Bold
    /\*.*?\*/, // Italic
    /\[.*?\]\(.*?\)/, // Links
    /^[-*+]\s+/m, // Lists
    /^\d+\.\s+/m, // Numbered lists
    /```[\s\S]*?```/, // Code blocks
    /`[^`]+`/, // Inline code
  ];
  return markdownPatterns.some((pattern) => pattern.test(str));
}

export function isHTML(str: string): boolean {
  if (typeof str !== "string") return false;
  const trimmed = str.trim();
  // Check for HTML patterns
  const htmlPatterns = [
    /^<!DOCTYPE\s+html/i, // DOCTYPE declaration
    /^<html[\s>]/i, // HTML tag
    /<\/html>\s*$/i, // Closing HTML tag
    /^<\!--[\s\S]*?-->/, // HTML comment
  ];
  // Check if it contains HTML tags
  const hasHTMLTags = /<[a-z][\s\S]*>/i.test(trimmed);
  const hasClosingTags = /<\/[a-z]+>/i.test(trimmed);

  // If it has both opening and closing tags, or matches specific patterns
  return (
    htmlPatterns.some((pattern) => pattern.test(trimmed)) ||
    (hasHTMLTags && hasClosingTags)
  );
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasStructuredHtmlTags(html: string): boolean {
  return /<(table|img|svg|canvas|video|audio|iframe|form|input|button|a|ul|ol|li|h1|h2|h3|h4|h5|h6|blockquote|code|pre)\b/i.test(
    html,
  );
}

interface WebhookInput {
  webhook_url?: string;
  method?: string;
  headers?: Record<string, unknown>;
  query_params?: Record<string, unknown>;
  content_type?: string;
  body_mode?: string;
  payload?: Record<string, unknown>;
  body?: string;
  body_json?: unknown;
}

interface AIInput {
  instructions?: string;
  input?: string | unknown;
}

export function formatStepInput(step: ExecutionStep): {
  content: string | unknown;
  type: "json" | "markdown" | "text";
  structure?: "ai_input";
} {
  if (step.step_type === "form_submission") {
    return { content: step.input, type: "json" };
  }
  if (step.step_type === "webhook") {
    // For webhook steps, show request details (URL/method/headers/body or payload)
    const inputObj = step.input as WebhookInput | undefined;
    return {
      content: {
        webhook_url: inputObj?.webhook_url || "N/A",
        method: inputObj?.method || "POST",
        headers: inputObj?.headers || {},
        query_params: inputObj?.query_params || {},
        content_type: inputObj?.content_type || "application/json",
        body_mode:
          inputObj?.body_mode ||
          (inputObj?.body || inputObj?.body_json ? "custom" : "auto"),
        payload: inputObj?.payload || undefined,
        body:
          inputObj?.body_json !== undefined && inputObj?.body_json !== null
            ? inputObj?.body_json
            : inputObj?.body || undefined,
      },
      type: "json",
    };
  }
  if (step.input && typeof step.input === "object") {
    // For AI steps, show instructions and input
    const inputObj = step.input as AIInput | undefined;
    if (!inputObj) {
      return { content: step.input, type: "json" };
    }
    const inputText = inputObj.input || "";
    const instructions = inputObj.instructions || step.instructions || "N/A";

    // Check if input text is markdown
    if (typeof inputText === "string" && isMarkdown(inputText)) {
      return {
        content: {
          model: step.model || "N/A",
          instructions,
          input: inputText,
        },
        type: "markdown",
        structure: "ai_input",
      };
    }

    // Otherwise return as JSON
    return {
      content: {
        model: step.model || "N/A",
        instructions,
        input: inputObj.input || inputObj,
      },
      type: "json",
      structure: "ai_input",
    };
  }
  return { content: step.input, type: "json" };
}

interface WebhookOutput {
  success?: boolean;
  response_status?: string | number;
  response_body?: unknown;
  error?: string | null;
}

export function formatStepOutput(step: ExecutionStep): {
  content: string | unknown;
  type: "json" | "markdown" | "text" | "html";
} {
  if (step.step_type === "final_output") {
    return { content: step.output, type: "json" };
  }
  if (step.step_type === "webhook") {
    // For webhook steps, show response details
    const outputObj = step.output as WebhookOutput | undefined;
    return {
      content: {
        success: outputObj?.success ?? false,
        response_status: outputObj?.response_status || "N/A",
        response_body: outputObj?.response_body || null,
        error: outputObj?.error || null,
      },
      type: "json",
    };
  }
  if (typeof step.output === "string") {
    // Check if it's HTML first (before JSON, as HTML might contain JSON-like syntax)
    if (isHTML(step.output)) {
      const strippedText = stripHtmlToText(step.output);
      const shouldUseMarkdown =
        strippedText.length > 0 &&
        isMarkdown(strippedText) &&
        !hasStructuredHtmlTags(step.output);

      if (shouldUseMarkdown) {
        return { content: strippedText, type: "markdown" };
      }

      return { content: step.output, type: "html" };
    }
    // Check if it's JSON
    if (isJSON(step.output)) {
      try {
        return { content: JSON.parse(step.output), type: "json" };
      } catch {
        // If parsing fails, treat as text
      }
    }
    // Check if it's Markdown
    if (isMarkdown(step.output)) {
      return { content: step.output, type: "markdown" };
    }
    return { content: step.output, type: "text" };
  }
  return { content: step.output, type: "json" };
}
