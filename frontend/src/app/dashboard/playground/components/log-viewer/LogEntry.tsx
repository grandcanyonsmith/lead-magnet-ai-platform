import React, { useState } from 'react';
import { FiAlertCircle, FiChevronDown, FiChevronRight, FiInfo } from 'react-icons/fi';

import { JsonViewer } from "@/components/ui/JsonViewer";

import type { NormalizedLog } from './types';
import { formatTimestamp } from './utils';
import { ContentRenderer } from './ContentRenderer';

export const LogEntry: React.FC<{ entry: NormalizedLog }> = ({ entry }) => {
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
