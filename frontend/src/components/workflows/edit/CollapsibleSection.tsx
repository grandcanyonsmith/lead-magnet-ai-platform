"use client";

import { FiChevronDown, FiChevronUp } from "react-icons/fi";

interface CollapsibleSectionProps {
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  isCollapsed,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 bg-muted/40 px-3 py-2 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 sm:px-4 sm:py-3"
        aria-expanded={!isCollapsed}
      >
        <h3 className="text-sm font-semibold text-foreground text-left flex-1 min-w-0">
          {title}
        </h3>
        {!isCollapsed ? (
          <FiChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <FiChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>
      {!isCollapsed && (
        <div className="p-3 sm:p-4">{children}</div>
      )}
    </div>
  );
}
