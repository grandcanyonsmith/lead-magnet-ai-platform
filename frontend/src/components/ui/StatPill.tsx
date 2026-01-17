"use client";

import { ReactNode } from "react";
import clsx from "clsx";

type StatTone = "neutral" | "positive" | "warning" | "danger";

const toneClasses: Record<StatTone, string> = {
  neutral: "bg-muted/40 text-foreground border-border",
  positive:
    "bg-emerald-50 text-emerald-900 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40",
  warning:
    "bg-amber-50 text-amber-900 border-amber-100 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-900/40",
  danger:
    "bg-red-50 text-red-900 border-red-100 dark:bg-red-900/20 dark:text-red-200 dark:border-red-900/40",
};

interface StatPillProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  helperText?: string;
  className?: string;
}

/**
 * Small stat component, useful for showing aggregated values inline.
 */
export function StatPill({
  label,
  value,
  icon,
  tone = "neutral",
  helperText,
  className = "",
}: StatPillProps) {
  return (
    <div
      className={clsx(
        "flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        toneClasses[tone],
        className,
      )}
    >
      {icon && <div className="text-base">{icon}</div>}
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-base font-semibold leading-6 break-words">{value}</p>
        {helperText && (
          <p className="text-xs text-muted-foreground break-words">{helperText}</p>
        )}
      </div>
    </div>
  );
}
