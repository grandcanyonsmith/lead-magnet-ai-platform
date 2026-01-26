import React, { useState } from "react";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";

interface CollapsiblePanelProps {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}

export function CollapsiblePanel({
  title,
  children,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onToggle,
  className = "",
  headerClassName = "",
  contentClassName = "",
  actions,
  icon,
}: CollapsiblePanelProps & { expanded?: boolean; onToggle?: (expanded: boolean) => void }) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const handleToggle = () => {
    const newExpanded = !isExpanded;
    if (controlledExpanded === undefined) {
      setInternalExpanded(newExpanded);
    }
    if (onToggle) {
      onToggle(newExpanded);
    }
  };

  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-card shadow-sm ${className}`}>
      <div 
        className={`bg-gray-50 dark:bg-gray-900/50 px-3 py-2 md:px-3 md:py-1.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between cursor-pointer select-none ${headerClassName}`}
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2">
          <button 
            type="button"
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none"
            aria-expanded={isExpanded}
          >
            {isExpanded ? <FiChevronDown className="w-4 h-4" /> : <FiChevronRight className="w-4 h-4" />}
          </button>
          {icon && <span className="text-gray-500 dark:text-gray-400">{icon}</span>}
          <div className="font-semibold text-sm text-gray-700 dark:text-gray-300">
            {title}
          </div>
        </div>
        {actions && (
          <div onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </div>
      
      {isExpanded && (
        <div className={`p-3 md:p-3 ${contentClassName}`}>
          {children}
        </div>
      )}
    </div>
  );
}
