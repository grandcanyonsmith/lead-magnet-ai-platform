import React from "react";

interface SectionHeaderProps {
  title: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  titleTitle?: string;
}

export function SectionHeader({
  title,
  actions,
  className = "",
  titleClassName = "",
  titleTitle,
}: SectionHeaderProps) {
  return (
    <div className={`bg-gray-50 dark:bg-gray-900/50 px-3 py-2 md:px-3 md:py-1.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2 ${className}`}>
      <span
        className={`text-sm md:text-xs font-semibold text-gray-700 dark:text-gray-300 ${titleClassName}`}
        title={titleTitle}
      >
        {title}
      </span>
      {actions && (
        <div className="flex items-center gap-1.5">
          {actions}
        </div>
      )}
    </div>
  );
}
