import React, { useMemo, useState } from 'react';

import { LogEntry } from './log-viewer/LogEntry';
import { LogViewerHeader } from './log-viewer/LogViewerHeader';
import { StepHeader } from './log-viewer/StepHeader';
import type { LevelFilter, NormalizedLog } from './log-viewer/types';
import { compactLogs, isHighlightLog, normalizeLog } from './log-viewer/utils';

interface LogViewerProps {
  logs: string[];
}

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

  const visibleCount = filteredLogs.reduce(
    (sum, entry) => sum + entry.repeatCount,
    0,
  );

  return (
    <div className="space-y-2">
      <LogViewerHeader
        query={query}
        onQueryChange={setQuery}
        filter={filter}
        onFilterChange={setFilter}
        isCompact={isCompact}
        onToggleCompact={() => setIsCompact((prev) => !prev)}
        stats={stats}
        visibleCount={visibleCount}
      />

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
