export const MAX_SYNTAX_HIGHLIGHT_CHARS = 50_000;
export const MAX_CHILDREN_PREVIEW = 60;
export const MAX_STRING_PREVIEW = 280;
export const MAX_STRING_PREVIEW_LINES = 14;
export const URL_PATH_PREVIEW = 42;
export const URL_HOST_MAX = 32;

export function truncateMiddle(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  const headLength = Math.max(6, Math.floor(maxLength * 0.6));
  const tailLength = Math.max(4, maxLength - headLength - 3);
  return `${text.slice(0, headLength)}...${text.slice(text.length - tailLength)}`;
}

export function safeParseUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function isImageUrl(value: string) {
  if (value.startsWith("data:image/")) return true;
  const url = safeParseUrl(value);
  if (!url) return false;
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(url.pathname);
}

export function formatUrlLabel(url: URL) {
  const host = url.hostname.replace(/^www\./, "");
  const hostLabel = truncateMiddle(host, URL_HOST_MAX);
  const path = url.pathname === "/" ? "" : url.pathname;
  const query = url.search ? `?${url.searchParams.toString()}` : "";
  const suffix = truncateMiddle(`${path}${query}`, URL_PATH_PREVIEW);
  return { hostLabel, suffix };
}

export function getLineCount(text: string): number {
  let count = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) count += 1; // '\n'
  }
  return count;
}

export function takeFirstLines(text: string, maxLines: number): string {
  if (maxLines <= 0) return "";
  let lineCount = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      lineCount += 1;
      if (lineCount > maxLines) {
        return text.slice(0, i);
      }
    }
  }
  return text;
}

export type FencedBlock = {
  prefix: string;
  language?: string;
  code: string;
  suffix: string;
};

export function extractFirstFencedBlock(text: string): FencedBlock | null {
  const open = text.indexOf("```");
  if (open === -1) return null;

  const openLineEnd = text.indexOf("\n", open + 3);
  if (openLineEnd === -1) return null;

  const language = text.slice(open + 3, openLineEnd).trim() || undefined;
  const codeStart = openLineEnd + 1;

  const close = text.indexOf("```", codeStart);
  if (close === -1) return null;

  const prefix = text.slice(0, open);
  const code = text.slice(codeStart, close);
  const suffix = text.slice(close + 3).replace(/^\n/, "");

  return { prefix, language, code, suffix };
}

export function looksLikeMarkdown(text: string): boolean {
  if (!text) return false;
  if (text.includes("```")) return true;
  if (/(^|\n)#{1,6}\s+\S/.test(text)) return true;
  if (/(^|\n)[*-]\s+\S/.test(text)) return true;
  if (/(^|\n)\d+\.\s+\S/.test(text)) return true;
  if (/\|.+\|\n\|[-:\s|]+\|/.test(text)) return true;
  if (/\*\*[^*]+\*\*/.test(text)) return true;
  return false;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function formatKeyCount(count: number) {
  return count === 1 ? "1 key" : `${count.toLocaleString()} keys`;
}

export function formatItemCount(count: number) {
  return count === 1 ? "1 item" : `${count.toLocaleString()} items`;
}
