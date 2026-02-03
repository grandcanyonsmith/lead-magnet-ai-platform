import type { ContentType, LogLevel, NormalizedLog, ParsedLog } from './types';

const HIGHLIGHT_PATTERNS = [
  /job\s+.*started/i,
  /job\s+.*completed/i,
  /processing workflow/i,
  /processing ai step/i,
  /step completed/i,
  /workflow completed/i,
  /\bfailed\b/i,
  /\berror\b/i,
  /\bwarning\b/i,
];

export const normalizeLevel = (
  level: string | undefined,
  messageText: string,
): LogLevel => {
  const normalized = (level || '').toUpperCase();
  if (normalized.startsWith('WARN')) return 'WARNING';
  if (normalized === 'ERROR' || normalized === 'CRITICAL') return 'ERROR';
  if (normalized === 'DEBUG' || normalized === 'TRACE') return 'DEBUG';
  if (normalized === 'INFO') return 'INFO';

  const lower = messageText.toLowerCase();
  if (lower.includes('error') || lower.includes('exception') || lower.includes('failed')) {
    return 'ERROR';
  }
  if (lower.includes('warn')) return 'WARNING';
  return 'INFO';
};

export const normalizeNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
};

export const stringifyContent = (content: any): string => {
  if (typeof content === 'string') return content;
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
};

export const formatTimestamp = (timestamp?: string): string => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleTimeString();
};

export const detectContentType = (
  text: string,
): { content: any; type: ContentType } => {
  const trimmed = text.trim();

  if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && trimmed.length >= 2) {
    try {
      const json = JSON.parse(trimmed);
      return { content: json, type: 'json' };
    } catch {}
  }

  if (/^\s*<(!DOCTYPE|[a-z]+)[^>]*>/i.test(trimmed)) {
    return { content: text, type: 'html' };
  }

  const hasMarkdown =
    /^#+\s/.test(trimmed) ||
    /^\s*[-*+]\s/.test(trimmed) ||
    /```/.test(trimmed) ||
    /\*\*[^*]+\*\*/.test(trimmed) ||
    /\[.*\]\(.*\)/.test(trimmed);

  if (hasMarkdown) {
    return { content: text, type: 'markdown' };
  }

  return { content: text, type: 'text' };
};

export const parseLog = (rawLog: string): ParsedLog => {
  let content = rawLog;
  let type: ContentType = 'text';
  let meta: ParsedLog['meta'] = undefined;
  let extra: ParsedLog['extra'] = undefined;

  const prefixes = ['[Worker Output] ', '[Worker Error] ', '[Local Worker] ', '[System] '];
  for (const prefix of prefixes) {
    if (content.startsWith(prefix)) {
      content = content.substring(prefix.length);
      break;
    }
  }

  try {
    const json = JSON.parse(content);
    if (json && typeof json === 'object') {
      if ('message' in json || 'msg' in json) {
        const message = json.message ?? json.msg;
        meta = {
          timestamp: json.timestamp ?? json.time,
          level: json.level ?? json.levelname,
          logger: json.logger ?? json.name,
        };

        const {
          message: _message,
          msg: _msg,
          timestamp,
          time,
          level,
          levelname,
          logger,
          name,
          ...rest
        } = json;
        extra = rest;

        if (typeof message === 'string') {
          const inner = detectContentType(message);
          content = inner.content;
          type = inner.type;
        } else {
          content = message;
          type = 'json';
        }
      } else {
        content = json;
        type = 'json';
      }
    } else {
      type = 'text';
      content = String(json);
    }
  } catch {
    const detection = detectContentType(content);
    content = detection.content;
    type = detection.type;
  }

  return { content, type, meta, extra };
};

export const normalizeLog = (raw: string): NormalizedLog => {
  const parsed = parseLog(raw);
  const messageText = stringifyContent(parsed.content);
  const level = normalizeLevel(parsed.meta?.level, messageText);
  const stepIndex = normalizeNumber(parsed.extra?.step_index ?? parsed.extra?.stepIndex);
  const stepName =
    typeof parsed.extra?.step_name === 'string' ? parsed.extra.step_name : undefined;
  const logger = parsed.meta?.logger ? String(parsed.meta.logger) : undefined;
  const service =
    typeof parsed.extra?.service === 'string' ? parsed.extra.service : undefined;

  const searchText = [
    raw,
    messageText,
    parsed.meta?.level,
    logger,
    stepName,
    service,
    typeof stepIndex === 'number' ? `step ${stepIndex + 1}` : undefined,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const fingerprint = [
    level,
    logger ?? '',
    typeof stepIndex === 'number' ? stepIndex : '',
    messageText,
  ].join('|');

  return {
    raw,
    parsed,
    level,
    messageText,
    searchText,
    stepIndex,
    stepName,
    logger,
    service,
    fingerprint,
    repeatCount: 1,
  };
};

export const compactLogs = (entries: NormalizedLog[]): NormalizedLog[] => {
  const compacted: NormalizedLog[] = [];
  for (const entry of entries) {
    const last = compacted[compacted.length - 1];
    if (last && last.fingerprint === entry.fingerprint) {
      last.repeatCount += 1;
      continue;
    }
    compacted.push({ ...entry });
  }
  return compacted;
};

export const isHighlightLog = (entry: NormalizedLog): boolean => {
  if (entry.level === 'ERROR' || entry.level === 'WARNING') return true;
  return HIGHLIGHT_PATTERNS.some((pattern) => pattern.test(entry.messageText));
};
