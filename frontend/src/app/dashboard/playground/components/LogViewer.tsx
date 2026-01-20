import React, { useState, useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { JsonViewer } from "@/components/ui/JsonViewer";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { FiChevronRight, FiChevronDown, FiCode, FiFileText, FiLayout, FiClock, FiAlertCircle, FiInfo } from 'react-icons/fi';

interface LogViewerProps {
  logs: string[];
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  return (
    <div className="space-y-1 font-mono text-xs">
      {logs.map((log, i) => (
        <LogEntry key={i} log={log} />
      ))}
    </div>
  );
};

const LogEntry: React.FC<{ log: string }> = ({ log }) => {
  const parsed = useMemo(() => parseLog(log), [log]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Render based on type
  return (
    <div className="group hover:bg-white/5 -mx-2 px-2 py-0.5 rounded transition-colors">
      <div className="flex items-start gap-2">
        {/* Timestamp / Meta Info if available */}
        {parsed.meta && (
           <div className="shrink-0 text-[10px] text-muted-foreground mt-0.5 select-none w-20 truncate" title={parsed.meta.timestamp}>
               {parsed.meta.timestamp ? new Date(parsed.meta.timestamp).toLocaleTimeString() : ''}
           </div>
        )}
        
        {/* Log Level Icon */}
        {parsed.meta?.level && (
            <div className="shrink-0 mt-0.5" title={parsed.meta.level}>
                {parsed.meta.level === 'ERROR' ? <FiAlertCircle className="text-red-500 w-3 h-3" /> :
                 parsed.meta.level === 'WARNING' ? <FiAlertCircle className="text-yellow-500 w-3 h-3" /> :
                 <div className="w-3 h-3" />}
            </div>
        )}

        <div className="flex-1 min-w-0 overflow-hidden">
            {/* Content */}
            <ContentRenderer content={parsed.content} type={parsed.type} />
            
            {/* Extra Data Expander */}
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
    return <div className="break-words whitespace-pre-wrap text-foreground/90">{String(content)}</div>;
};
