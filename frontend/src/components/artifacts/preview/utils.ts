import {
  isShellExecutorLogsPayload,
  type ShellExecutorLogsPayload,
} from "@/components/artifacts/ShellExecutorLogsPreview";
import {
  isCodeExecutorLogsPayload,
  type CodeExecutorLogsPayload,
} from "@/components/artifacts/CodeExecutorLogsPreview";

export const JSON_MARKDOWN_MAX_DEPTH = 5;
export const JSON_MARKDOWN_MAX_ARRAY_ITEMS = 60;
export const JSON_MARKDOWN_MAX_FIELDS = 60;
export const JSON_MARKDOWN_MAX_CHARS = 200_000;
export const JSON_MARKDOWN_TABLE_MAX_ROWS = 24;
export const JSON_MARKDOWN_TABLE_MAX_COLUMNS = 8;
export const JSON_MARKDOWN_TABLE_CELL_MAX_CHARS = 140;
export const JSON_MARKDOWN_SINGLE_KEYS = new Set([
  "markdown",
  "md",
  "content",
  "body",
  "text",
  "output",
  "result",
]);

/**
 * Detect content type from file extension as fallback
 */
export function detectContentTypeFromExtension(fileName?: string): string | null {
  if (!fileName) return null;
  const ext = fileName.split(".").pop()?.toLowerCase();
  const typeMap: Record<string, string> = {
    html: "text/html",
    htm: "text/html",
    md: "text/markdown",
    markdown: "text/markdown",
    txt: "text/plain",
    json: "application/json",
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
  };
  return typeMap[ext || ""] || null;
}

export function normalizeContentType(value?: string | null): string | null {
  if (!value) return null;
  const base = value.split(";")[0]?.trim().toLowerCase();
  return base || null;
}

export function normalizePreviewUrl(url?: string | null): string | null {
  const raw = (url || "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return raw.split("?")[0].split("#")[0];
  }
}

/**
 * Extract HTML content from markdown code blocks
 * Handles both ```html and ``` markers
 */
export function extractHtmlFromCodeBlocks(text: string): string {
  const trimmed = text.trim();

  // Check for ```html code block
  if (trimmed.startsWith("```html")) {
    const match = trimmed.match(/^```html\s*([\s\S]*?)\s*```$/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Check for generic ``` code block
  if (trimmed.startsWith("```")) {
    const match = trimmed.match(/^```\s*([\s\S]*?)\s*```$/);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Return original text if no code blocks found
  return text;
}

export function shouldRewriteEditorOverlayApiUrl(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function getLocalApiUrlFallback(): string {
  if (typeof window === "undefined") return "http://localhost:3001";
  try {
    const origin = window.location.origin || "http://localhost:3000";
    // If the dashboard is running on :3000, the local API is typically :3001.
    return origin.replace(/:\d+$/, ":3001");
  } catch {
    return "http://localhost:3001";
  }
}

export function rewriteLeadMagnetEditorOverlayApiUrl(
  html: string,
  apiUrl: string,
): string {
  if (!html || !html.includes("Lead Magnet Editor Overlay")) return html;

  // Only rewrite the apiUrl inside the injected CFG block.
  // Example:
  // const CFG = {
  //   jobId: "...",
  //   tenantId: "...",
  //   apiUrl: "https://...",
  // };
  return html.replace(
    /(const CFG = \{\s*[\s\S]*?apiUrl:\s*)"[^"]*"/,
    `$1"${apiUrl}"`,
  );
}

export function stripInjectedLeadMagnetScripts(html: string): string {
  return String(html || "")
    .replace(
      /<!--\s*Lead Magnet Editor Overlay\s*-->[\s\S]*?<\/script>\s*/gi,
      "",
    )
    .replace(
      /<!--\s*Lead Magnet Tracking Script\s*-->[\s\S]*?<\/script>\s*/gi,
      "",
    )
    .trim();
}

export function extractJsonFromCodeBlock(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return trimmed;
}

export function parseNestedJsonString(value: string, maxDepth = 2): unknown | null {
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

export function formatExecutorLogsContent(value: string): string {
  const parsed = parseNestedJsonString(value);
  if (parsed === null) return value;
  if (typeof parsed === "string") return parsed;
  try {
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function isJsonPrimitive(
  value: unknown,
): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

export function formatJsonPrimitive(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return String(value);
}

export function formatJsonSummary(value: unknown): string {
  if (Array.isArray(value)) return `[Array(${value.length})]`;
  if (isPlainObject(value)) return `[Object(${Object.keys(value).length})]`;
  return String(value);
}

export function sanitizeMarkdownTableCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw = formatJsonPrimitive(value);
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\n/g, "<br/>");
  const escaped = normalized.replace(/\|/g, "\\|");
  if (escaped.length > JSON_MARKDOWN_TABLE_CELL_MAX_CHARS) {
    return `${escaped.slice(0, JSON_MARKDOWN_TABLE_CELL_MAX_CHARS)}…`;
  }
  return escaped;
}

export function buildMarkdownTableRows(
  items: Array<Record<string, unknown>>,
): { lines: string[]; shownCount: number } | null {
  if (items.length === 0) return null;
  const candidateKeys = Array.from(
    new Set(items.flatMap((item) => Object.keys(item))),
  );
  const filteredKeys = candidateKeys.filter((key) =>
    items.every((item) => {
      if (!(key in item)) return true;
      return isJsonPrimitive(item[key]);
    }),
  );
  if (filteredKeys.length === 0) return null;
  const columns = filteredKeys.slice(0, JSON_MARKDOWN_TABLE_MAX_COLUMNS);
  if (columns.length === 0) return null;

  const shownCount = Math.min(items.length, JSON_MARKDOWN_TABLE_MAX_ROWS);
  const lines: string[] = [];
  lines.push(`| ${columns.join(" | ")} |`);
  lines.push(`| ${columns.map(() => "---").join(" | ")} |`);
  items.slice(0, shownCount).forEach((item) => {
    const row = columns
      .map((key) => sanitizeMarkdownTableCell(item[key]))
      .join(" | ");
    lines.push(`| ${row} |`);
  });

  return { lines, shownCount };
}

export function extractSingleMarkdownField(value: unknown): string | null {
  if (!isPlainObject(value)) return null;
  const entries = Object.entries(value);
  if (entries.length !== 1) return null;
  const [key, fieldValue] = entries[0] ?? [];
  const normalizedKey = String(key || "").toLowerCase();
  if (!JSON_MARKDOWN_SINGLE_KEYS.has(normalizedKey)) return null;
  return typeof fieldValue === "string" ? fieldValue : null;
}

export function buildJsonMarkdownLines(
  value: unknown,
  depth: number,
  label?: string,
): string[] {
  const lines: string[] = [];
  const headingLevel = Math.min(6, depth + 2);
  const headingPrefix = "#".repeat(headingLevel);

  if (depth >= JSON_MARKDOWN_MAX_DEPTH) {
    const summary = formatJsonSummary(value);
    if (label) {
      lines.push(`- **${label}**: ${summary}`);
    } else {
      lines.push(summary);
    }
    return lines;
  }

  if (isJsonPrimitive(value)) {
    const textValue = formatJsonPrimitive(value);
    const isLongText =
      typeof value === "string" &&
      (value.includes("\n") || value.length > 160);
    if (label) {
      if (isLongText) {
        lines.push(`${headingPrefix} ${label}`);
        lines.push(textValue);
      } else {
        lines.push(`- **${label}**: ${textValue}`);
      }
    } else {
      lines.push(textValue);
    }
    return lines;
  }

  if (Array.isArray(value)) {
    if (label) {
      lines.push(`${headingPrefix} ${label}`);
    }
    if (value.length === 0) {
      lines.push("_(empty)_");
      return lines;
    }
    const onlyObjects = value.every((item) => isPlainObject(item));
    if (onlyObjects) {
      const table = buildMarkdownTableRows(value as Array<Record<string, unknown>>);
      if (table) {
        lines.push(...table.lines);
        if (value.length > table.shownCount) {
          lines.push("");
          lines.push(`_(+${value.length - table.shownCount} more rows)_`);
        }
        return lines;
      }
    }

    const allPrimitive = value.every((item) => isJsonPrimitive(item));
    const shown = Math.min(value.length, JSON_MARKDOWN_MAX_ARRAY_ITEMS);
    if (allPrimitive) {
      value.slice(0, shown).forEach((item) => {
        lines.push(`- ${formatJsonPrimitive(item)}`);
      });
    } else {
      value.slice(0, shown).forEach((item, index) => {
        if (index > 0) lines.push("");
        lines.push(
          ...buildJsonMarkdownLines(item, depth + 1, `Item ${index + 1}`),
        );
      });
    }
    if (value.length > shown) {
      if (!allPrimitive) lines.push("");
      lines.push(`_(+${value.length - shown} more items)_`);
    }
    return lines;
  }

  if (isPlainObject(value)) {
    if (label) {
      lines.push(`${headingPrefix} ${label}`);
    }
    const entries = Object.entries(value);
    if (entries.length === 0) {
      lines.push("_(empty)_");
      return lines;
    }
    const shown = Math.min(entries.length, JSON_MARKDOWN_MAX_FIELDS);
    entries.slice(0, shown).forEach(([key, entryValue], index) => {
      if (index > 0) lines.push("");
      lines.push(...buildJsonMarkdownLines(entryValue, depth + 1, key));
    });
    if (entries.length > shown) {
      lines.push("");
      lines.push(`_(+${entries.length - shown} more fields)_`);
    }
    return lines;
  }

  const fallback = String(value);
  if (label) {
    lines.push(`- **${label}**: ${fallback}`);
  } else {
    lines.push(fallback);
  }
  return lines;
}

export function convertJsonToMarkdown(value: unknown): string | null {
  if (value === undefined) return null;
  let workingValue = value;
  if (typeof workingValue === "string") {
    const trimmed = workingValue.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "object") {
          workingValue = parsed;
        }
      } catch {
        // keep as string
      }
    }
  }
  const singleField = extractSingleMarkdownField(workingValue);
  let markdown =
    singleField ?? buildJsonMarkdownLines(workingValue, 0).join("\n");
  markdown = markdown.replace(/\n{3,}/g, "\n\n").trim();
  if (!markdown) return null;
  if (markdown.length > JSON_MARKDOWN_MAX_CHARS) {
    markdown = `${markdown.slice(0, JSON_MARKDOWN_MAX_CHARS)}\n\n_(truncated)_`;
  }
  return markdown;
}

export function tryParseShellExecutorLogsPayload(
  value: unknown,
): ShellExecutorLogsPayload | null {
  if (!value) return null;
  if (isShellExecutorLogsPayload(value)) return value;
  if (typeof value === "string") {
    const parsed = parseNestedJsonString(value);
    return parsed && isShellExecutorLogsPayload(parsed) ? parsed : null;
  }
  return null;
}

export function tryParseCodeExecutorLogsPayload(
  value: unknown,
): CodeExecutorLogsPayload | null {
  if (!value) return null;
  if (isCodeExecutorLogsPayload(value)) return value;
  if (typeof value === "string") {
    const parsed = parseNestedJsonString(value);
    return parsed && isCodeExecutorLogsPayload(parsed) ? parsed : null;
  }
  return null;
}

export function isExecutorLogsFileName(fileName?: string): boolean {
  const normalized = String(fileName || "")
    .toLowerCase()
    .replace(/\s+/g, "_");
  return (
    normalized.includes("shell_executor_logs") ||
    normalized.includes("code_executor_logs") ||
    normalized.includes("executor_logs")
  );
}
