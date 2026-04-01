const PYTHON_HEREDOC_START =
  /^\s*\$?\s*python(?:\d+(?:\.\d+)?)?(?:\s|$).*<<\s*['"]?([A-Za-z0-9_]+)['"]?/i;

const HTML_TAG_REGEX =
  /^\s*<(!DOCTYPE|html|head|body|div|span|p|section|article|main|header|footer|h[1-6]|table|thead|tbody|tr|th|td|ul|ol|li|img|svg|style|script|form|input|textarea|select|option|link|meta|button|iframe)\b/i;

const FILE_HEREDOC_PATTERNS = [
  /^\s*(?:\$?\s*)?cat\s*(?:1>>|1>|>>|>\|?)\s*(?<file>"[^"]+"|'[^']+'|[^\s<]+)\s*<<-?\s*['"]?(?<marker>[A-Za-z0-9_]+)['"]?\s*$/,
  /^\s*(?:\$?\s*)?cat\s*<<-?\s*['"]?(?<marker>[A-Za-z0-9_]+)['"]?\s*(?:1>>|1>|>>|>\|?)\s*(?<file>"[^"]+"|'[^']+'|[^\s<]+)\s*$/,
  /^\s*(?:\$?\s*)?tee\s+(?<file>"[^"]+"|'[^']+'|[^\s>]+)(?:\s*>\s*\/dev\/null)?\s*<<-?\s*['"]?(?<marker>[A-Za-z0-9_]+)['"]?\s*$/,
  /^\s*(?:\$?\s*)?tee\s*<<-?\s*['"]?(?<marker>[A-Za-z0-9_]+)['"]?\s+(?<file>"[^"]+"|'[^']+'|[^\s>]+)(?:\s*>\s*\/dev\/null)?\s*$/,
];

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  css: "text/css",
  csv: "text/csv",
  htm: "text/html",
  html: "text/html",
  js: "text/javascript",
  json: "application/json",
  markdown: "text/markdown",
  md: "text/markdown",
  mjs: "text/javascript",
  svg: "image/svg+xml",
  text: "text/plain",
  ts: "text/typescript",
  txt: "text/plain",
  xml: "application/xml",
};

export interface ShellCreatedFile {
  fileName: string;
  content: string;
  contentType: string;
  marker: string;
  startLineIndex: number;
  endLineIndex: number;
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function looksLikeHtmlContent(value: string): boolean {
  return HTML_TAG_REGEX.test(value.trim());
}

function inferContentType(fileName: string, content: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  if (CONTENT_TYPE_BY_EXTENSION[extension]) {
    return CONTENT_TYPE_BY_EXTENSION[extension];
  }
  if (looksLikeHtmlContent(content)) {
    return "text/html";
  }
  return "text/plain";
}

function matchShellCreatedFileStart(line: string): {
  fileName: string;
  marker: string;
} | null {
  for (const pattern of FILE_HEREDOC_PATTERNS) {
    const match = line.match(pattern);
    const fileName = stripWrappingQuotes(match?.groups?.file || "");
    const marker = match?.groups?.marker || "";
    if (fileName && marker) {
      return { fileName, marker };
    }
  }
  return null;
}

export function extractShellCreatedFiles(command: string): ShellCreatedFile[] {
  const normalized = command.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const matches: ShellCreatedFile[] = [];
  let pythonEndMarker: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    if (pythonEndMarker) {
      if (line.trim() === pythonEndMarker) {
        pythonEndMarker = null;
      }
      continue;
    }

    const pythonMatch = line.match(PYTHON_HEREDOC_START);
    if (pythonMatch?.[1]) {
      const marker = pythonMatch[1];
      const hasClosingMarker = lines
        .slice(index + 1)
        .some((nextLine) => nextLine.trim() === marker);
      if (hasClosingMarker) {
        pythonEndMarker = marker;
        continue;
      }
    }

    const fileStart = matchShellCreatedFileStart(line);
    if (!fileStart) continue;

    const contentLines: string[] = [];
    let endLineIndex = -1;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const nextLine = lines[cursor] ?? "";
      if (nextLine.trim() === fileStart.marker) {
        endLineIndex = cursor;
        break;
      }
      contentLines.push(nextLine);
    }

    if (endLineIndex === -1) {
      continue;
    }

    const content = contentLines.join("\n");
    matches.push({
      fileName: fileStart.fileName,
      content,
      contentType: inferContentType(fileStart.fileName, content),
      marker: fileStart.marker,
      startLineIndex: index,
      endLineIndex,
    });
    index = endLineIndex;
  }

  return matches;
}

export function extractLatestHtmlFromShellCommand(command: string): string | null {
  const matches = extractShellCreatedFiles(command);
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const candidate = matches[index];
    if (
      candidate.contentType === "text/html" ||
      candidate.contentType === "image/svg+xml" ||
      looksLikeHtmlContent(candidate.content)
    ) {
      return candidate.content.trim();
    }
  }
  return null;
}
