"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import { useRemarkGfm } from "@/hooks/useRemarkGfm";

const ReactMarkdown = dynamic(() => import("react-markdown"), {
  ssr: false,
});

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

  if (!remarkGfm) {
    return <pre className={fallbackClassName ?? className}>{value}</pre>;
  }

  if (!className) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {value}
      </ReactMarkdown>
    );
  }

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {value}
      </ReactMarkdown>
    </div>
  );
}
