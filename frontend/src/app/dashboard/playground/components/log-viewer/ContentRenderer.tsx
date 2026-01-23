import React, { useEffect, useRef, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FiCopy, FiLayout } from 'react-icons/fi';

import { JsonViewer } from "@/components/ui/JsonViewer";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";

import type { ContentType } from './types';

const URL_REGEX = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const URL_TRAILING_PUNCTUATION = /[),.;:!?]+$/;

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

export const ContentRenderer: React.FC<{ content: any; type: ContentType }> = ({
  content,
  type,
}) => {
  if (type === 'json') {
    return <JsonViewer value={content} defaultExpandedDepth={1} />;
  }

  if (type === 'html') {
    return (
      <div className="mt-1 mb-2 border border-border rounded-md overflow-hidden bg-white text-black p-4">
        <div className="text-[10px] text-gray-500 mb-2 uppercase font-semibold flex items-center gap-1">
          <FiLayout /> HTML Preview
        </div>
        {/* Safe-ish rendering. For production, use DOMPurify. */}
        <div
          dangerouslySetInnerHTML={{ __html: content }}
          className="prose prose-sm max-w-none"
        />
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
            },
          }}
        />
      </div>
    );
  }

  return (
    <div className="break-words whitespace-pre-wrap text-foreground/90">
      {renderTextWithLinks(String(content))}
    </div>
  );
};
