import React from 'react';
import { FiAlertCircle, FiFilter, FiInfo, FiSearch } from 'react-icons/fi';

import type { LevelFilter } from './types';

interface LogViewerHeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
  filter: LevelFilter;
  onFilterChange: (filter: LevelFilter) => void;
  isCompact: boolean;
  onToggleCompact: () => void;
  stats: {
    total: number;
    errors: number;
    warnings: number;
  };
  visibleCount: number;
}

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

export const LogViewerHeader: React.FC<LogViewerHeaderProps> = ({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  isCompact,
  onToggleCompact,
  stats,
  visibleCount,
}) => {
  return (
    <div className="sticky top-0 z-10 rounded-xl border border-border bg-background/95 px-3 py-2 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <FiSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
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
            onClick={() => onFilterChange('all')}
          />
          <FilterButton
            label="Highlights"
            active={filter === 'highlights'}
            onClick={() => onFilterChange('highlights')}
          />
          <FilterButton
            label="Errors"
            active={filter === 'errors'}
            onClick={() => onFilterChange('errors')}
          />
        </div>

        <button
          type="button"
          onClick={onToggleCompact}
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
          Showing {visibleCount}
        </span>
      </div>
    </div>
  );
};
