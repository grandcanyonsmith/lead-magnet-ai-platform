import {
  isHTML,
  isJSON,
  isMarkdown,
} from "@/utils/jobFormatting";

export type FormattedContent = {
  content: string | unknown;
  type: "json" | "markdown" | "text" | "html";
};

export function coerceJsonContent(formatted: FormattedContent): FormattedContent {
  if (formatted.type === "json") {
    return formatted;
  }
  if (typeof formatted.content !== "string") {
    return formatted;
  }
  const trimmed = formatted.content.trim();
  if (!trimmed) return formatted;
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return formatted;
  }
  try {
    const parsed = JSON.parse(trimmed);
    return { content: parsed, type: "json" };
  } catch {
    return formatted;
  }
}

export function formatContentForDetail(value: unknown): FormattedContent {
  if (typeof value === "string") {
    if (isHTML(value)) {
      return { content: value, type: "html" };
    }
    if (isJSON(value)) {
      try {
        return { content: JSON.parse(value), type: "json" };
      } catch {
        return { content: value, type: "text" };
      }
    }
    if (isMarkdown(value)) {
      return { content: value, type: "markdown" };
    }
    return { content: value, type: "text" };
  }
  return { content: value, type: "json" };
}

export function toCopyText(formatted: FormattedContent): string {
  if (formatted.type === "json") {
    try {
      const jsonString = JSON.stringify(formatted.content, null, 2);
      if (typeof jsonString === "string") {
        return jsonString;
      }
      return formatted.content === undefined ? "" : String(formatted.content);
    } catch {
      return String(formatted.content);
    }
  }
  return typeof formatted.content === "string"
    ? formatted.content
    : formatted.content === undefined
      ? ""
      : String(formatted.content);
}

export function toPreviewText(formatted: FormattedContent, maxLength = 280): string {
  const raw = toCopyText(formatted).trim();
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, maxLength - 3)}...`;
}

export function abbreviateUrl(url: string, startLength = 28, endLength = 12): string {
  if (!url) return "";
  if (url.length <= startLength + endLength + 3) return url;
  return `${url.slice(0, startLength)}...${url.slice(-endLength)}`;
}

export type Tool = string | { type: string; [key: string]: unknown };

export function getToolLabel(tool: Tool): string {
  return typeof tool === "string" ? tool : tool.type || "unknown";
}
