import React, { useState } from "react";
import { FiChevronRight, FiChevronDown, FiAlertCircle, FiCheckCircle, FiInfo, FiAlertTriangle } from "react-icons/fi";
import { cn } from "@/lib/utils";

export interface LogNode {
  id: string;
  content: React.ReactNode;
  children?: LogNode[];
  level?: "info" | "warning" | "error" | "success";
  timestamp?: string;
  defaultExpanded?: boolean;
  className?: string;
}

interface LogTreeProps {
  logs: LogNode[];
  className?: string;
}

const LevelIcon = ({ level }: { level?: LogNode["level"] }) => {
  switch (level) {
    case "error":
      return <FiAlertCircle className="w-4 h-4 text-red-500" />;
    case "warning":
      return <FiAlertTriangle className="w-4 h-4 text-amber-500" />;
    case "success":
      return <FiCheckCircle className="w-4 h-4 text-green-500" />;
    case "info":
    default:
      return <FiInfo className="w-4 h-4 text-blue-500" />;
  }
};

const LogTreeNode = ({ node, depth = 0 }: { node: LogNode; depth?: number }) => {
  const [expanded, setExpanded] = useState(node.defaultExpanded ?? false);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className={cn("flex flex-col", node.className)}>
      <div
        className={cn(
          "flex items-start gap-2 py-1 px-2 hover:bg-muted/50 rounded transition-colors",
          hasChildren && "cursor-pointer"
        )}
        style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        <div className="mt-0.5 shrink-0">
          {hasChildren ? (
            expanded ? (
              <FiChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <FiChevronRight className="w-4 h-4 text-muted-foreground" />
            )
          ) : (
            <div className="w-4 h-4" />
          )}
        </div>
        
        {node.level && (
            <div className="mt-0.5 shrink-0">
                <LevelIcon level={node.level} />
            </div>
        )}

        <div className="flex-1 min-w-0 break-words text-sm font-mono">
          {node.content}
        </div>

        {node.timestamp && (
          <div className="text-xs text-muted-foreground shrink-0 ml-2">
            {node.timestamp}
          </div>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="flex flex-col border-l border-border ml-4">
          {node.children!.map((child) => (
            <LogTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const LogTree: React.FC<LogTreeProps> = ({ logs, className }) => {
  return (
    <div className={cn("flex flex-col w-full", className)}>
      {logs.map((log) => (
        <LogTreeNode key={log.id} node={log} />
      ))}
    </div>
  );
};
