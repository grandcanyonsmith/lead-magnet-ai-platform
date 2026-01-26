"use client";

import type { ComponentType, ReactNode } from "react";
import dynamic from "next/dynamic";
import type { Components } from "react-markdown";
import { useRemarkGfm } from "@/hooks/useRemarkGfm";

// Extend Components to include custom elements
type ExtendedComponents = Components & {
  "color-swatch"?: ComponentType<{
    children?: ReactNode;
    [key: string]: unknown;
  }>;
};

const ReactMarkdown = dynamic(() => import("react-markdown"), {
  ssr: false,
});

const COLOR_HEX_REGEX =
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g;

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

type HastNode = {
  type: "root" | "element" | "text";
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

function createTextNode(value: string): HastNode {
  return { type: "text", value };
}

function createColorNode(value: string): HastNode {
  return {
    type: "element",
    tagName: "color-swatch",
    properties: { "data-hex": value },
    children: [createTextNode(value)],
  };
}

function splitTextByColors(text: string): HastNode[] | null {
  if (!text || !text.includes("#")) return null;
  COLOR_HEX_REGEX.lastIndex = 0;
  const nodes: HastNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = COLOR_HEX_REGEX.exec(text)) !== null) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(createTextNode(text.slice(lastIndex, index)));
    }
    nodes.push(createColorNode(match[0]));
    lastIndex = index + match[0].length;
  }

  if (nodes.length === 0) return null;
  if (lastIndex < text.length) {
    nodes.push(createTextNode(text.slice(lastIndex)));
  }
  return nodes;
}

function applyColorSwatches(node: HastNode) {
  if (!node.children || node.children.length === 0) return;

  const nextChildren: HastNode[] = [];
  node.children.forEach((child) => {
    if (child.type === "text" && typeof child.value === "string") {
      const replacement = splitTextByColors(child.value);
      if (replacement) {
        nextChildren.push(...replacement);
        return;
      }
    }
    if (child.type === "element" && child.children?.length) {
      applyColorSwatches(child);
    }
    nextChildren.push(child);
  });

  node.children = nextChildren;
}

const rehypeColorSwatches = () => (tree: HastNode) => {
  applyColorSwatches(tree);
};

function extractText(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(extractText).join("");
  }
  return "";
}

function ColorSwatch({
  children,
  ...props
}: {
  children?: ReactNode;
  [key: string]: unknown;
}) {
  const dataHex = typeof props["data-hex"] === "string" ? props["data-hex"] : "";
  const value = dataHex || extractText(children);

  if (!value) {
    return <>{children}</>;
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 px-1.5 py-0.5 align-middle font-mono text-[0.85em] text-gray-700 dark:text-gray-200"
      title={value}
    >
      <span
        className="inline-block h-3 w-3 rounded-sm border border-gray-300 dark:border-gray-600"
        style={{ backgroundColor: value }}
        aria-hidden="true"
      />
      <span>{value}</span>
    </span>
  );
}

function renderTextWithColors(text: string): ReactNode {
  if (!text || !text.includes("#")) return text;
  COLOR_HEX_REGEX.lastIndex = 0;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = COLOR_HEX_REGEX.exec(text)) !== null) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }
    parts.push(<ColorSwatch key={`${match[0]}-${index}`} data-hex={match[0]} />);
    lastIndex = index + match[0].length;
  }

  if (parts.length === 0) return text;
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function renderTextWithHighlights(text: string): ReactNode {
  if (!text) return text;
  
  // First, split by URLs
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  
  // Reset regex
  URL_REGEX.lastIndex = 0;
  
  while ((match = URL_REGEX.exec(text)) !== null) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push(renderTextWithColors(text.slice(lastIndex, index)));
    }
    const url = match[0];
    parts.push(
      <a
        key={`url-${index}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 hover:underline decoration-blue-400/40"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    );
    lastIndex = index + url.length;
  }
  
  if (parts.length === 0) {
    return renderTextWithColors(text);
  }
  
  if (lastIndex < text.length) {
    parts.push(renderTextWithColors(text.slice(lastIndex)));
  }
  
  return parts;
}

type MarkdownRendererProps = {
  value: string;
  className?: string;
  fallbackClassName?: string;
  components?: Record<string, ComponentType<any>>;
};

export function MarkdownRenderer({
  value,
  className,
  fallbackClassName,
  components,
}: MarkdownRendererProps) {
  const remarkGfm = useRemarkGfm();
  const mergedComponents: ExtendedComponents = {
    "color-swatch": ColorSwatch,
    ...(components ?? {}),
  };

  // Fallback to plain text rendering if remarkGfm isn't loaded yet
  if (!remarkGfm) {
    return (
      <pre className={fallbackClassName ?? className}>
        {renderTextWithHighlights(value)}
      </pre>
    );
  }

  if (!className) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeColorSwatches]}
        components={mergedComponents as Components}
      >
        {value}
      </ReactMarkdown>
    );
  }

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeColorSwatches]}
        components={mergedComponents as Components}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}
