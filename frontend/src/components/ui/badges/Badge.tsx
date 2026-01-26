import React from "react";

interface BadgeProps {
  icon?: React.ReactNode;
  label?: React.ReactNode;
  count?: number;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  active?: boolean;
}

export function Badge({
  icon,
  label,
  count,
  variant = "default",
  className = "",
  onClick,
  title,
  active = false,
}: BadgeProps) {
  const baseStyles = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer select-none";
  
  const variants = {
    default: "bg-primary/10 text-primary-700 dark:text-primary-300 hover:bg-primary/20",
    outline: "border border-border text-foreground hover:bg-muted",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-muted text-muted-foreground hover:text-foreground",
    destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20",
  };

  const activeStyles = active ? "ring-2 ring-primary ring-offset-1 dark:ring-offset-background" : "";

  return (
    <div
      className={`${baseStyles} ${variants[variant]} ${activeStyles} ${className}`}
      onClick={onClick}
      title={title}
      role="button"
      tabIndex={0}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {label && <span>{label}</span>}
      {count !== undefined && count > 0 && (
        <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background/50 text-[10px]">
          {count}
        </span>
      )}
    </div>
  );
}
