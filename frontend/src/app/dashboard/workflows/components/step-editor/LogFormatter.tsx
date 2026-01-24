import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FiLayout, FiCopy } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';

// Regex patterns
const KPI_REGEX = /input\.kpis\s*=\s*(\[[\s\S]*?\]);?/;
const CITATIONS_REGEX = /input\.citations\s*=\s*(\{[\s\S]*?\});?/;
const HTML_TAG_REGEX =
  /^\s*<(!DOCTYPE|html|head|body|div|span|p|section|article|main|header|footer|h[1-6]|table|thead|tbody|tr|th|td|ul|ol|li|img|svg|style|script|form|input|textarea|select|option|link|meta|button|iframe)\b/i;
const MARKDOWN_PATTERNS = [
  /```/,
  /(^|\n)#{1,6}\s+\S/,
  /(^|\n)[*-]\s+\S/,
  /(^|\n)\d+\.\s+\S/,
  /\|.+\|\n\|[-:\s|]+\|/,
  /\*\*[^*]+\*\*/,
  /\[.+\]\(.+\)/,
];
const PYTHON_PATTERNS = [
  /(^|\n)\s*def\s+\w+\s*\(.*\)\s*:/,
  /(^|\n)\s*class\s+\w+/,
  /(^|\n)\s*import\s+\w+/,
  /(^|\n)\s*from\s+\w+\s+import\s+/,
  /if\s+__name__\s*==\s*['"]__main__['"]/,
  /Traceback \(most recent call last\):/,
  /File ".*", line \d+/,
];

// Helper to clean JS object string to valid JSON
const cleanJsToJSON = (str: string) => {
  try {
    // 1. Quote unquoted keys: { key: 'val' } -> { "key": 'val' }
    let cleaned = str.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
    // 2. Convert single quotes to double quotes (simplistic)
    cleaned = cleaned.replace(/'/g, '"');
    // 3. Remove trailing commas
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
    
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn("Failed to parse JS object:", e);
    return null;
  }
};

const looksLikeMarkdown = (value: string) =>
  MARKDOWN_PATTERNS.some((pattern) => pattern.test(value));

const looksLikePython = (value: string) =>
  PYTHON_PATTERNS.some((pattern) => pattern.test(value));

export const looksLikeHtml = (value: string) =>
  HTML_TAG_REGEX.test(value.trim());

export const buildHtmlSrcDoc = (html: string) => {
  const trimmed = html.trim();
  const hasDocTag = /<!doctype/i.test(trimmed) || /<html[\s>]/i.test(trimmed);
  if (hasDocTag) {
    return trimmed;
  }
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<base target="_blank" />',
    '<style>',
    'body { margin: 0; padding: 12px; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }',
    'img, video { max-width: 100%; height: auto; }',
    '</style>',
    '</head>',
    '<body>',
    trimmed,
    '</body>',
    '</html>',
  ].join('');
};

interface KpiItem {
  label: string;
  value: string;
  note?: string;
}

interface CitationItem {
  label: string;
  url: string;
  tooltip?: string;
}

// -----------------------------------------------------------------------------
// Render Components
// -----------------------------------------------------------------------------

const KpiTable = ({ kpis }: { kpis: KpiItem[] }) => (
  <div className="my-2 overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg text-xs">
    <table className="w-full text-left border-collapse">
      <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
        <tr>
          <th className="p-2 font-medium border-b border-gray-200 dark:border-gray-700">Label</th>
          <th className="p-2 font-medium border-b border-gray-200 dark:border-gray-700">Value</th>
          <th className="p-2 font-medium border-b border-gray-200 dark:border-gray-700">Note</th>
        </tr>
      </thead>
      <tbody>
        {kpis.map((kpi, i) => (
          <tr key={i} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-white/5">
            <td className="p-2 font-mono text-blue-600 dark:text-blue-400">{kpi.label}</td>
            <td className="p-2 font-mono text-green-600 dark:text-green-400">{kpi.value}</td>
            <td className="p-2 italic text-gray-400 dark:text-gray-500">{kpi.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const CitationTable = ({ citations }: { citations: Record<string, CitationItem> }) => (
  <div className="my-2 overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg text-xs">
    <table className="w-full text-left border-collapse">
      <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
        <tr>
          <th className="p-2 font-medium border-b border-gray-200 dark:border-gray-700 w-10">ID</th>
          <th className="p-2 font-medium border-b border-gray-200 dark:border-gray-700">Label</th>
          <th className="p-2 font-medium border-b border-gray-200 dark:border-gray-700">URL</th>
          <th className="p-2 font-medium border-b border-gray-200 dark:border-gray-700">Tooltip</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(citations).map(([id, item], i) => (
          <tr key={i} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-white/5">
            <td className="p-2 font-mono text-yellow-600 dark:text-yellow-500 text-right">{id}</td>
            <td className="p-2 font-mono text-blue-600 dark:text-blue-400">{item.label}</td>
            <td className="p-2">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                {item.url.length > 40 ? item.url.substring(0, 37) + '...' : item.url}
                <span className="opacity-50">🔗</span>
              </a>
            </td>
            <td className="p-2 text-gray-400 dark:text-gray-500">{item.tooltip}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const HtmlPreview = ({ html }: { html: string }) => (
  <div className="my-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 overflow-hidden">
    <div className="flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <FiLayout className="h-3 w-3" />
      HTML Preview
    </div>
    <iframe
      title="HTML Preview"
      className="w-full h-56 bg-white"
      sandbox=""
      srcDoc={buildHtmlSrcDoc(html)}
    />
  </div>
);

const renderMarkdown = (value: string, options?: { forceCodeLanguage?: string }) => {
  const content = options?.forceCodeLanguage
    ? `\`\`\`${options.forceCodeLanguage}\n${value}\n\`\`\``
    : value;

  return (
    <MarkdownRenderer
      value={content}
      className="whitespace-pre-wrap break-words"
      fallbackClassName="whitespace-pre-wrap break-words"
      components={{
        pre: ({ children }) => <>{children}</>,
        code({ inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          if (!inline && match) {
            const raw =
              Array.isArray(children)
                ? children.map((child) => (typeof child === 'string' ? child : '')).join('')
                : String(children);
            return (
              <div className="my-2 rounded-lg border border-gray-800 bg-black/30 overflow-hidden">
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    background: 'transparent',
                    padding: '12px',
                    fontSize: '12px',
                    lineHeight: '1.6',
                  }}
                  {...props}
                >
                  {raw.replace(/\n$/, '')}
                </SyntaxHighlighter>
              </div>
            );
          }
          return (
            <code className="rounded bg-white/10 px-1 py-0.5 text-[0.9em]" {...props}>
              {children}
            </code>
          );
        },
        a: ({ href, children, ...props }: any) => {
          const handleCopy = (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (href) {
              navigator.clipboard.writeText(href);
              toast.success("Link copied");
            }
          };

          return (
            <span className="inline-flex items-baseline gap-1 group/link align-bottom">
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 hover:underline decoration-blue-400/40 break-all"
                {...props}
              >
                {children}
              </a>
              <button
                onClick={handleCopy}
                className="opacity-0 group-hover/link:opacity-100 transition-opacity text-gray-500 hover:text-white p-0.5 rounded hover:bg-white/10 flex-shrink-0 self-center"
                title="Copy link"
              >
                <FiCopy className="w-3 h-3" />
              </button>
            </span>
          );
        },
        ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 m-0">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 m-0">{children}</ol>,
        p: ({ children }) => (
          <p className="whitespace-pre-wrap break-words m-0">{children}</p>
        ),
      }}
    />
  );
};

// -----------------------------------------------------------------------------
// Parser & Renderer
// -----------------------------------------------------------------------------

export function formatLogMessage(message: string): React.ReactNode {
  if (!message) return null;

  // 1. Detect KPIs
  const kpiMatch = message.match(KPI_REGEX);
  if (kpiMatch) {
    const kpiData = cleanJsToJSON(kpiMatch[1]);
    if (kpiData && Array.isArray(kpiData)) {
      return (
        <div>
          <div className="text-gray-400 mb-1">Detected KPIs data:</div>
          <KpiTable kpis={kpiData} />
        </div>
      );
    }
  }

  // 2. Detect Citations
  const citMatch = message.match(CITATIONS_REGEX);
  if (citMatch) {
    const citData = cleanJsToJSON(citMatch[1]);
    if (citData && typeof citData === 'object') {
      return (
        <div>
          <div className="text-gray-400 mb-1">Detected Citations data:</div>
          <CitationTable citations={citData} />
        </div>
      );
    }
  }

  // 3. Detect pure JSON (render as markdown code block)
  const trimmed = message.trim();
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      const json = JSON.parse(trimmed);
      return (
        <div className="my-2">
          {renderMarkdown(JSON.stringify(json, null, 2), { forceCodeLanguage: 'json' })}
        </div>
      );
    } catch {
      // Not valid JSON, continue to text formatting
    }
  }

  // 4. Detect HTML (render iframe preview)
  if (looksLikeHtml(trimmed)) {
    return <HtmlPreview html={message} />;
  }

  // 5. Detect Python (render as code block)
  if (looksLikePython(message)) {
    return renderMarkdown(message, { forceCodeLanguage: 'python' });
  }

  // 6. Markdown (render markdown)
  if (looksLikeMarkdown(message)) {
    return renderMarkdown(message);
  }

  // 7. Default text (render markdown for color swatches)
  return renderMarkdown(message);
}
