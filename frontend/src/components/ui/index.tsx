/**
 * Reusable UI components
 */

import React from "react";
import { FiLoader } from "react-icons/fi";

// Export new shared components
export { LoadingState } from "./LoadingState";
export { ErrorState } from "./ErrorState";
export { Skeleton } from "./Skeleton";
export { EmptyState as EmptyStateNew } from "./EmptyState";
export { StatusBadge as StatusBadgeNew } from "./StatusBadge";
export { SectionCard } from "./SectionCard";
export { KeyValueList } from "./KeyValueList";
export { StatPill } from "./StatPill";
export { VisuallyHidden } from "./VisuallyHidden";
export { Button, type ButtonProps } from "./Button";
export { Input, type InputProps } from "./Input";
export { Label } from "./Label";
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./Card";
export { Textarea, type TextareaProps } from "./Textarea";
export { Select, type SelectProps } from "./Select";
export { Avatar, type AvatarProps } from "./Avatar";
export { Badge, type BadgeProps } from "./Badge";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuShortcut,
} from "./DropdownMenu";

// Legacy components for backward compatibility
interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({
  size = "md",
  className = "",
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    icon: "h-4 w-4", // Added for compatibility with button
    default: "w-6 h-6", // Added for compatibility
  };

  const selectedSize = sizeClasses[size as keyof typeof sizeClasses] || sizeClasses.md;

  return (
    <FiLoader className={`${selectedSize} animate-spin ${className}`} />
  );
}

interface ErrorMessageProps {
  message: string;
  className?: string;
}

export function ErrorMessage({ message, className = "" }: ErrorMessageProps) {
  return <div className={`text-red-600 text-sm ${className}`}>{message}</div>;
}

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({
  title = "No data",
  message = "There is no data to display.",
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      {icon && <div className="mb-4 flex justify-center">{icon}</div>}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-4">{message}</p>
      {action && <div>{action}</div>}
    </div>
  );
}

import { Status } from "@/types/common";
import { STATUS_LABELS, STATUS_COLORS } from "@/constants/statuses";

interface StatusBadgeProps {
  status: Status | string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const label = STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status;
  const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || "gray";

  const colorClasses: Record<string, string> = {
    blue: "bg-blue-100 text-blue-800",
    green: "bg-green-100 text-green-800",
    red: "bg-red-100 text-red-800",
    yellow: "bg-yellow-100 text-yellow-800",
    gray: "bg-gray-100 text-gray-800",
  };

  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded-full ${colorClasses[color]} ${className}`}
    >
      {label}
    </span>
  );
}
