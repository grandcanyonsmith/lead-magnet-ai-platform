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
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
      >
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {isCollapsed ? (
          <FiChevronDown className="w-5 h-5 text-gray-500" />
        ) : (
          <FiChevronUp className="w-5 h-5 text-gray-500" />
        )}
      </button>
      {!isCollapsed && <div className="p-4">{children}</div>}
    </div>
  );
}
