"use client";

import { ReactNode } from "react";
import clsx from "clsx";
import { cn } from "@/lib/utils";

type SectionPadding = "none" | "sm" | "md" | "lg";

const paddingMap: Record<SectionPadding, string> = {
  none: "p-0",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

interface SectionCardProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  padding?: SectionPadding;
  stickyHeader?: boolean;
}

/**
 * Shared card component to provide consistent containers across dashboard views.
 */
export function SectionCard({
  title,
  description,
  icon,
  actions,
  children,
  className = "",
  contentClassName = "",
  padding = "md",
  stickyHeader = false,
}: SectionCardProps) {
  const hasHeader = title || description || icon || actions;
  const paddingClass = paddingMap[padding];

  return (
    <section
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      {hasHeader && (
        <header
          className={cn(
            "flex flex-col gap-3 border-b",
            paddingClass,
            stickyHeader && "sticky top-0 z-10 bg-card/95 backdrop-blur",
          )}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              {icon && <div className="text-primary">{icon}</div>}
              <div>
                {title && (
                  <h3 className="text-lg font-semibold leading-none tracking-tight">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="text-sm text-muted-foreground mt-1.5">{description}</p>
                )}
              </div>
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>
        </header>
      )}

      <div
        className={clsx(paddingClass, hasHeader && "pt-4", contentClassName)}
      >
        {children}
      </div>
    </section>
  );
}
