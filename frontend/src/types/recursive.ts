import React from "react";

/**
 * Generic interface for a node in a recursive tree structure.
 * Useful for logs, file explorers, and nested data views.
 */
export interface TreeNode<T = any> {
  id: string;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  data?: T;
  children?: TreeNode<T>[];
  isExpanded?: boolean;
  isLoading?: boolean;
  className?: string;
}

/**
 * Generic interface for a recursive content block.
 * Useful for steps, cards, and nested UI sections.
 */
export interface BlockNode<T = any> {
  id: string;
  title?: React.ReactNode;
  header?: React.ReactNode;
  content?: React.ReactNode;
  children?: BlockNode<T>[];
  data?: T;
  isExpanded?: boolean;
  isLoading?: boolean;
  isCollapsible?: boolean;
  className?: string;
  status?: "pending" | "in_progress" | "completed" | "failed" | "neutral";
}

/**
 * Common props for recursive components
 */
export interface RecursiveComponentProps<T> {
  node: T;
  depth?: number;
  onToggle?: (id: string, expanded: boolean) => void;
  onSelect?: (id: string, node: T) => void;
  className?: string;
}
