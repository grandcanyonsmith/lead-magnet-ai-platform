import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { JsonViewer } from "@/components/ui/JsonViewer";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import {
  FiChevronRight,
  FiChevronDown,
  FiCode,
  FiFileText,
  FiLayout,
  FiClock,
  FiAlertCircle,
  FiInfo,
  FiSearch,
  FiFilter,
  FiCopy,
} from 'react-icons/fi';

interface LogViewerProps {
  logs: string[];
}

type LogLevel = 'ERROR' | 'WARNING' | 'INFO' | 'DEBUG' | 'UNKNOWN';
type LevelFilter = 'all' | 'highlights' | 'errors';

interface NormalizedLog {
  raw: string;
  parsed: ParsedLog;
  level: LogLevel;
  messageText: string;
  searchText: string;
  stepIndex?: number;
  stepName?: string;
  logger?: string;
  service?: string;
  fingerprint: string;
  repeatCount: number;
}

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

const URL_REGEX = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const URL_TRAILING_PUNCTUATION = /[),.;:!?]+$/;

const normalizeLevel = (level: string | undefined, messageText: string): LogLevel => {
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

const normalizeNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
};

const stringifyContent = (content: any): string => {
  if (typeof content === 'string') return content;
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
};

const formatTimestamp = (timestamp?: string): string => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleTimeString();
};

const normalizeLog = (raw: string): NormalizedLog => {
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

const compactLogs = (entries: NormalizedLog[]): NormalizedLog[] => {
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

const isHighlightLog = (entry: NormalizedLog): boolean => {
  if (entry.level === 'ERROR' || entry.level === 'WARNING') return true;
  return HIGHLIGHT_PATTERNS.some((pattern) => pattern.test(entry.messageText));
};

const FilterButton: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
      active
        ? 'bg-primary text-primary-foreground'
        : 'border border-border bg-background text-muted-foreground hover:text-foreground'
    }`}
  >
    {label}
  </button>
);

const StepHeader: React.FC<{ stepIndex: number; stepName?: string }> = ({
  stepIndex,
  stepName,
}) => {
  const label = stepName ? `Step ${stepIndex + 1} - ${stepName}` : `Step ${stepIndex + 1}`;
  return (
    <div className="my-3 flex items-center gap-2 text-[11px] text-muted-foreground">
      <div className="h-px flex-1 bg-border/70" />
      <span
        className="inline-flex max-w-full items-center rounded-full bg-muted/60 px-3 py-1 font-semibold"
        title={label}
      >
        <span className="truncate">{label}</span>
      </span>
      <div className="h-px flex-1 bg-border/70" />
    </div>
  );
};

export const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LevelFilter>('all');
  const [isCompact, setIsCompact] = useState(true);

  const normalizedLogs = useMemo(() => logs.map(normalizeLog), [logs]);

  const stats = useMemo(() => {
    return normalizedLogs.reduce(
      (acc, entry) => {
        acc.total += 1;
        if (entry.level === 'ERROR') acc.errors += 1;
        if (entry.level === 'WARNING') acc.warnings += 1;
        return acc;
      },
      { total: 0, errors: 0, warnings: 0 },
    );
  }, [normalizedLogs]);

  const filteredLogs = useMemo(() => {
    let next = normalizedLogs;
    if (filter === 'errors') {
      next = next.filter((entry) => entry.level === 'ERROR');
    } else if (filter === 'highlights') {
      next = next.filter((entry) => isHighlightLog(entry));
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      next = next.filter((entry) => entry.searchText.includes(q));
    }

    return isCompact ? compactLogs(next) : next.map((entry) => ({ ...entry }));
  }, [normalizedLogs, filter, query, isCompact]);

  const renderItems = useMemo(() => {
    const items: Array<
      | { type: 'header'; stepIndex: number; stepName?: string }
      | { type: 'log'; log: NormalizedLog }
    > = [];
    let lastStepIndex: number | null = null;
    filteredLogs.forEach((entry) => {
      if (typeof entry.stepIndex === 'number' && entry.stepIndex !== lastStepIndex) {
        items.push({
          type: 'header',
          stepIndex: entry.stepIndex,
          stepName: entry.stepName,
        });
        lastStepIndex = entry.stepIndex;
      }
      items.push({ type: 'log', log: entry });
    });
    return items;
  }, [filteredLogs]);

  const totalVisible = filteredLogs.reduce((sum, entry) => sum + entry.repeatCount, 0);

  return (
    <div className="space-y-2">
      <div className="sticky top-0 z-10 rounded-xl border border-border bg-background/95 px-3 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <FiSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search logs, steps, services..."
              className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
              <FiFilter className="h-3 w-3" />
              Filter
            </span>
            <FilterButton
              label="All"
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
            <FilterButton
              label="Highlights"
              active={filter === 'highlights'}
              onClick={() => setFilter('highlights')}
            />
            <FilterButton
              label="Errors"
              active={filter === 'errors'}
              onClick={() => setFilter('errors')}
            />
          </div>

          <button
            type="button"
            onClick={() => setIsCompact((prev) => !prev)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
              isCompact
                ? 'bg-muted text-foreground'
                : 'border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {isCompact ? 'Compact' : 'Full'}
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <FiInfo className="h-3 w-3" />
            Total {stats.total}
          </span>
          <span className="inline-flex items-center gap-1 text-amber-600">
            <FiAlertCircle className="h-3 w-3" />
            Warnings {stats.warnings}
          </span>
          <span className="inline-flex items-center gap-1 text-red-600">
            <FiAlertCircle className="h-3 w-3" />
            Errors {stats.errors}
          </span>
          <span className="ml-auto inline-flex items-center gap-1">
            Showing {totalVisible}
          </span>
        </div>
      </div>

      <div className="space-y-1 font-mono text-xs">
        {renderItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
            No logs match the current filters.
          </div>
        ) : (
          renderItems.map((item, index) => {
            if (item.type === 'header') {
              return (
                <StepHeader
                  key={`header-${item.stepIndex}-${index}`}
                  stepIndex={item.stepIndex}
                  stepName={item.stepName}
                />
              );
            }
            return <LogEntry key={`log-${index}`} entry={item.log} />;
          })
        )}
      </div>
    </div>
  );
};

const LogEntry: React.FC<{ entry: NormalizedLog }> = ({ entry }) => {
  const { parsed, level, repeatCount, stepIndex, stepName, logger, service } = entry;
  const [isExpanded, setIsExpanded] = useState(false);

  const timestampLabel = formatTimestamp(parsed.meta?.timestamp);

  const tags = [
    typeof stepIndex === 'number'
      ? {
          label: stepName
            ? `Step ${stepIndex + 1}: ${stepName}`
            : `Step ${stepIndex + 1}`,
          className: 'bg-primary/10 text-primary-700 dark:text-primary-300 border-primary/20',
        }
      : null,
    logger
      ? { label: logger, className: 'bg-muted/60 text-foreground/80 border-border' }
      : null,
    service
      ? {
          label: service,
          className: 'bg-slate-50 text-slate-600 border-border dark:bg-slate-800/60 dark:text-slate-200',
        }
      : null,
    repeatCount > 1
      ? {
          label: `x${repeatCount}`,
          className: 'bg-muted text-muted-foreground border-border',
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; className: string }>;

  const levelIcon =
    level === 'ERROR' ? (
      <FiAlertCircle className="text-red-500 w-3 h-3" />
    ) : level === 'WARNING' ? (
      <FiAlertCircle className="text-amber-500 w-3 h-3" />
    ) : (
      <FiInfo className="text-muted-foreground w-3 h-3" />
    );

  const rowTone =
    level === 'ERROR'
      ? 'border-l-2 border-red-500/70 bg-red-50/40 dark:bg-red-500/10'
      : level === 'WARNING'
        ? 'border-l-2 border-amber-400/70 bg-amber-50/40 dark:bg-amber-500/10'
        : 'border-l-2 border-transparent';

  return (
    <div
      className={`group hover:bg-white/5 -mx-2 px-2 py-1 rounded transition-colors ${rowTone}`}
    >
      <div className="flex items-start gap-2">
        {parsed.meta && (
          <div
            className="shrink-0 text-[10px] text-muted-foreground mt-0.5 select-none w-20 truncate"
            title={parsed.meta.timestamp}
          >
            {timestampLabel}
          </div>
        )}

        <div className="shrink-0 mt-0.5" title={level}>
          {levelIcon}
        </div>

        <div className="flex-1 min-w-0 overflow-hidden">
          {tags.length > 0 && (
            <div className="mb-1 flex flex-wrap items-center gap-1 text-[10px]">
              {tags.map((tag, idx) => (
                <span
                  key={`${tag.label}-${idx}`}
                  className={`inline-flex max-w-[260px] items-center rounded-full border px-2 py-0.5 font-semibold ${tag.className}`}
                  title={tag.label}
                >
                  <span className="truncate">{tag.label}</span>
                </span>
              ))}
            </div>
          )}

          <ContentRenderer content={parsed.content} type={parsed.type} />

          {parsed.extra && Object.keys(parsed.extra).length > 0 && (
            <div className="mt-1">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded"
              >
                {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
                {isExpanded ? 'Hide Details' : 'Show Details'}
              </button>
              {isExpanded && (
                <div className="mt-1 pl-2 border-l-2 border-border/50">
                  <JsonViewer value={parsed.extra} defaultExpandedDepth={1} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Parsers & Types ---

type ContentType = 'text' | 'json' | 'html' | 'markdown' | 'structured_log';

interface ParsedLog {
  content: any;
  type: ContentType;
  meta?: {
    timestamp?: string;
    level?: string;
    logger?: string;
  };
  extra?: Record<string, any>;
}

const parseLog = (rawLog: string): ParsedLog => {
  let content = rawLog;
  let type: ContentType = 'text';
  let meta: ParsedLog['meta'] = undefined;
  let extra: ParsedLog['extra'] = undefined;

  // 1. Strip prefixes
  const prefixes = ['[Worker Output] ', '[Worker Error] ', '[Local Worker] ', '[System] '];
  let prefix = '';
  for (const p of prefixes) {
    if (content.startsWith(p)) {
      prefix = p;
      content = content.substring(p.length);
      break;
    }
  }

  // 2. Try JSON parse
  try {
    const json = JSON.parse(content);
    if (json && typeof json === 'object') {
        // Is it a structured log?
        // Common python logger JSON fields: timestamp, level, message, logger, etc.
        if ('message' in json || 'msg' in json) {
            const message = json.message || json.msg;
            // Extract meta
            meta = {
                timestamp: json.timestamp || json.time,
                level: json.level || json.levelname,
                logger: json.logger || json.name,
            };
            
            // Extract extra (everything else)
            const { message: _, msg: __, timestamp, time, level, levelname, logger, name, ...rest } = json;
            extra = rest;
            
            // Now analyze the message content itself
            if (typeof message === 'string') {
                const inner = detectContentType(message);
                content = inner.content; // Render the message string specially if possible
                type = inner.type;
            } else {
                content = message; // Message might be object
                type = 'json';
            }
        } else {
            // It's just a JSON object (data output)
            content = json;
            type = 'json';
        }
    } else {
        // Primitive JSON (number, boolean)
        type = 'text';
        content = String(json);
    }
  } catch (e) {
    // Not JSON, analyze as text
    const detection = detectContentType(content);
    content = detection.content;
    type = detection.type;
  }

  return { content, type, meta, extra };
};

const detectContentType = (text: string): { content: any, type: ContentType } => {
    const trimmed = text.trim();

    // Check for JSON string inside text? (Aggressive, maybe skip to avoid false positives)
    // Only if it starts with { or [
    if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && trimmed.length > 2) {
        try {
            const json = JSON.parse(trimmed);
            return { content: json, type: 'json' };
        } catch {}
    }

    // HTML Detection (Simple)
    // Starts with <tag> or <!DOCTYPE
    if (/^\s*<(!DOCTYPE|[a-z]+)[^>]*>/i.test(trimmed)) {
        return { content: text, type: 'html' };
    }

    // Markdown Detection
    // Multiline or specific markers
    const hasMarkdown = 
        /^#+\s/.test(trimmed) || // Headers
        /^\s*[-*+]\s/.test(trimmed) || // Lists
        /```/.test(trimmed) || // Code blocks
        /\*\*[^*]+\*\*/.test(trimmed) || // Bold
        /\[.*\]\(.*\)/.test(trimmed); // Links
    
    if (hasMarkdown) {
        return { content: text, type: 'markdown' };
    }

    return { content: text, type: 'text' };
};

// --- Renderers ---

const copyToClipboard = async (value: string): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // fallback below
    }
  }

  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    document.body.removeChild(textarea);
    return false;
  }
};

const normalizeUrlForHref = (url: string): string => {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
};

const UrlToken: React.FC<{ url: string }> = ({ url }) => {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const success = await copyToClipboard(url);
    if (success) {
      setCopied(true);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 1400);
    }
  };

  return (
    <span className="inline-flex items-center gap-1 align-baseline">
      <a
        href={normalizeUrlForHref(url)}
        target="_blank"
        rel="noreferrer noopener"
        className="text-sky-600 dark:text-sky-400 hover:underline break-all"
        title={url}
      >
        {url}
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center rounded border border-border/60 bg-background/70 px-1 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
        title="Copy URL"
      >
        <FiCopy className="h-3 w-3" />
      </button>
      {copied && <span className="text-[10px] text-muted-foreground">Copied</span>}
    </span>
  );
};

const renderTextWithLinks = (text: string): React.ReactNode => {
  if (!text || (!text.includes('http') && !text.includes('www.'))) return text;
  URL_REGEX.lastIndex = 0;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = URL_REGEX.exec(text)) !== null) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    let urlText = match[0];
    let trailing = '';
    const trailingMatch = urlText.match(URL_TRAILING_PUNCTUATION);
    if (trailingMatch) {
      trailing = trailingMatch[0];
      urlText = urlText.slice(0, -trailing.length);
    }

    if (urlText) {
      parts.push(<UrlToken key={`${urlText}-${matchIndex}`} url={urlText} />);
    }
    if (trailing) {
      parts.push(trailing);
    }
    lastIndex = matchIndex + match[0].length;
  }

  if (parts.length === 0) return text;
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
};

const ContentRenderer: React.FC<{ content: any, type: ContentType }> = ({ content, type }) => {
    if (type === 'json') {
        return <JsonViewer value={content} defaultExpandedDepth={1} />;
    }

    if (type === 'html') {
        return (
            <div className="mt-1 mb-2 border border-border rounded-md overflow-hidden bg-white text-black p-4">
                <div className="text-[10px] text-gray-500 mb-2 uppercase font-semibold flex items-center gap-1">
                    <FiLayout /> HTML Preview
                </div>
                {/* 
                   Safe-ish rendering. For production, use DOMPurify. 
                   Here in playground we trust the local/user generated content mostly.
                */}
                <div dangerouslySetInnerHTML={{ __html: content }} className="prose prose-sm max-w-none" />
            </div>
        );
    }

    if (type === 'markdown') {
        return (
            <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                <MarkdownRenderer
                    value={String(content)}
                    fallbackClassName="whitespace-pre-wrap break-words"
                    components={{
                        code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                                <SyntaxHighlighter
                                    style={vscDarkPlus}
                                    language={match[1]}
                                    PreTag="div"
                                    {...props}
                                >
                                    {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                            ) : (
                                <code className={className} {...props}>
                                    {children}
                                </code>
                            );
                        }
                    }}
                />
            </div>
        );
    }

    // Default Text
    return (
      <div className="break-words whitespace-pre-wrap text-foreground/90">
        {renderTextWithLinks(String(content))}
      </div>
    );
};
