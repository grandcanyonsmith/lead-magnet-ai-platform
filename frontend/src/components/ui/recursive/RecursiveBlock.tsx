import React, { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { BlockNode } from "@/types/recursive";

export interface RecursiveBlockProps {
  node: BlockNode;
  depth?: number;
  className?: string;
  defaultExpanded?: boolean;
  onToggle?: (id: string, expanded: boolean) => void;
  renderHeader?: (node: BlockNode, isExpanded: boolean) => React.ReactNode;
  renderBody?: (node: BlockNode) => React.ReactNode;
  renderContent?: (node: BlockNode) => React.ReactNode;
}

export const RecursiveBlock: React.FC<RecursiveBlockProps> = ({
  node,
  depth = 0,
  className,
  defaultExpanded = true,
  onToggle,
  renderHeader,
  renderBody,
  renderContent,
}) => {
  const isControlled = node.isExpanded !== undefined;
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isExpanded = isControlled ? node.isExpanded : internalExpanded;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.isCollapsible === false) return;
    
    const newExpanded = !isExpanded;
    if (!isControlled) {
      setInternalExpanded(newExpanded);
    }
    onToggle?.(node.id, newExpanded);
  };

  const statusColors = {
    pending: "border-l-muted-foreground/30",
    in_progress: "border-l-blue-500",
    completed: "border-l-green-500",
    failed: "border-l-red-500",
    neutral: "border-l-border",
  };

  const statusColor = node.status ? statusColors[node.status] : statusColors.neutral;

  return (
    <div
      className={cn(
        "flex flex-col w-full transition-all duration-200",
        depth > 0 && "mt-2",
        className
      )}
    >
      {/* Header / Block Container */}
      <div
        className={cn(
          "relative flex flex-col rounded-lg border bg-card text-card-foreground shadow-sm",
          node.status && "border-l-4",
          statusColor
        )}
      >
        {/* Header Row */}
        <div
          className={cn(
            "flex items-center p-3 gap-2",
            node.isCollapsible !== false && "cursor-pointer hover:bg-muted/50 transition-colors"
          )}
          onClick={handleToggle}
        >
          {node.isLoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
          )}
          {node.isCollapsible !== false && (
            <button
              type="button"
              className="p-1 rounded-md hover:bg-muted text-muted-foreground"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <ChevronDownIcon className="w-4 h-4" />
              ) : (
                <ChevronRightIcon className="w-4 h-4" />
              )}
            </button>
          )}

          <div className="flex-1 min-w-0">
            {renderHeader ? (
              renderHeader(node, !!isExpanded)
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{node.title || node.id}</span>
                {node.header}
              </div>
            )}
          </div>
        </div>

        {/* Body (Always Visible) */}
        {renderBody && (
          <div className="border-t border-border/50">
            {renderBody(node)}
          </div>
        )}

        {/* Content Body (Expanded) */}
        {isExpanded && (
          <div className="border-t border-border/50">
            {renderContent ? (
              renderContent(node)
            ) : (
              node.content && <div className="p-4">{node.content}</div>
            )}
            
            {/* Recursive Children */}
            {node.children && node.children.length > 0 && (
              <div className={cn("p-2 pl-4 space-y-2 bg-muted/10")}>
                {node.children.map((child) => (
                  <RecursiveBlock
                    key={child.id}
                    node={child}
                    depth={depth + 1}
                    defaultExpanded={defaultExpanded}
                    onToggle={onToggle}
                    renderHeader={renderHeader}
                    renderContent={renderContent}
                    renderBody={renderBody}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
