
import type { LogEntry } from "@/components/ui/StreamViewerUI";

export const parseLogs = (text: string): LogEntry[] => {
  if (!text) return [];

  const lines = text.split('\n');
  const logs: LogEntry[] = [];
  let buffer: string[] = [];
  let currentLevel = 'info';

  const TOOL_OUTPUT_MARKER = /^\[Tool output\]\s*$/i;
  const CODE_MARKER = /^\[Code interpreter\](.*)$/i;
  const CODE_LOGS_MARKER = /^\[Code interpreter logs\]\s*$/i;
  const CODE_ERROR_MARKER = /^\[Code interpreter error\]\s*$/i;

  const flush = () => {
    if (buffer.length === 0) return;
    logs.push({
      timestamp: Date.now() / 1000, // We don't have real timestamps for historical logs, so we use current time or 0
      message: buffer.join('\n'),
      level: currentLevel,
      type: 'log'
    });
    buffer = [];
  };

  lines.forEach(line => {
    const trimmed = line.trim();

    if (TOOL_OUTPUT_MARKER.test(trimmed)) {
      flush();
      currentLevel = 'info';
      buffer.push("📤 [Tool output]");
      return;
    }
    if (CODE_LOGS_MARKER.test(trimmed)) {
      flush();
      currentLevel = 'info';
      buffer.push("📤 [Code logs]");
      return;
    }
    if (CODE_ERROR_MARKER.test(trimmed)) {
      flush();
      currentLevel = 'error';
      buffer.push("⚠️ [Code error]");
      return;
    }
    const codeMatch = trimmed.match(CODE_MARKER);
    if (codeMatch) {
      flush();
      currentLevel = 'info';
      const status = codeMatch[1]?.trim();
      buffer.push(status ? `💻 [Code interpreter] ${status}` : "💻 [Code interpreter]");
      return;
    }

    buffer.push(line);
  });

  flush();
  return logs;
};
