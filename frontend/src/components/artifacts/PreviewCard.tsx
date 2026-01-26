"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface PreviewCardProps {
  title: string;
  description?: React.ReactNode;
  showDescription?: boolean;
  preview: React.ReactNode;
  onClick?: () => void;
  className?: string;
  cardClassName?: string;
  previewClassName?: string;
  footerClassName?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  overlayTopLeft?: React.ReactNode;
  overlayTopRight?: React.ReactNode;
  footerContent?: React.ReactNode;
}

export function PreviewCard({
  title,
  description,
  showDescription,
  preview,
  onClick,
  className,
  cardClassName,
  previewClassName,
  footerClassName,
  actions,
  meta,
  overlayTopLeft,
  overlayTopRight,
  footerContent,
}: PreviewCardProps) {
  const canPreview = Boolean(onClick);
  const hasDescription =
    typeof description === "string" ? description.trim().length > 0 : Boolean(description);
  const shouldShowDescription = Boolean(showDescription) && hasDescription;

  return (
    <div
      role={canPreview ? "button" : undefined}
      tabIndex={canPreview ? 0 : -1}
      aria-disabled={!canPreview}
      onClick={() => onClick?.()}
      onKeyDown={(event) => {
        if (!canPreview) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      }}
      className={className}
    >
      <div
        className={cn(
          "flex w-full flex-col overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-md transition group-hover:shadow-lg",
          cardClassName,
        )}
      >
        <div className={cn("relative w-full overflow-hidden", previewClassName)}>
          <div className="h-full w-full">{preview}</div>
          {overlayTopLeft ? (
            <div className="absolute left-3 top-3 z-10">{overlayTopLeft}</div>
          ) : null}
          {overlayTopRight ? (
            <div className="absolute right-3 top-3 z-10">{overlayTopRight}</div>
          ) : null}
        </div>
        <div
          className={cn(
            "border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 px-3 py-2.5",
            footerClassName,
          )}
        >
          {footerContent ? (
            footerContent
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">
                  {title}
                </p>
                {shouldShowDescription ? (
                  <p className="text-[10px] text-gray-600 dark:text-gray-400 line-clamp-1 mt-0.5">
                    {description}
                  </p>
                ) : null}
                {meta ? <div className="mt-1">{meta}</div> : null}
              </div>
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
