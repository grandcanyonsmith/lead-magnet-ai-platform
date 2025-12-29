/**
 * Skeleton loader component for better loading states
 * Provides consistent skeleton UI across the app
 */

import React from "react";
import clsx from "clsx";

interface SkeletonLoaderProps {
  className?: string;
  lines?: number;
  showAvatar?: boolean;
  showButton?: boolean;
  variant?: "text" | "card" | "list" | "table";
}

export const SkeletonLoader = React.memo(function SkeletonLoader({
  className = "",
  lines = 3,
  showAvatar = false,
  showButton = false,
  variant = "text",
}: SkeletonLoaderProps) {
  const baseClasses = "animate-pulse bg-gray-200 rounded";

  if (variant === "card") {
    return (
      <div className={clsx("bg-white rounded-lg shadow-sm border border-gray-200 p-6", className)}>
        {showAvatar && (
          <div className="flex items-center space-x-4 mb-4">
            <div className={clsx(baseClasses, "h-12 w-12 rounded-full")}></div>
            <div className="flex-1 space-y-2">
              <div className={clsx(baseClasses, "h-4 w-3/4")}></div>
              <div className={clsx(baseClasses, "h-4 w-1/2")}></div>
            </div>
          </div>
        )}
        <div className="space-y-3">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className={clsx(
                baseClasses,
                "h-4",
                i === lines - 1 ? "w-5/6" : "w-full"
              )}
            ></div>
          ))}
        </div>
        {showButton && (
          <div className={clsx(baseClasses, "h-10 w-32 mt-4")}></div>
        )}
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className={clsx("space-y-4", className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            {showAvatar && (
              <div className={clsx(baseClasses, "h-10 w-10 rounded-full")}></div>
            )}
            <div className="flex-1 space-y-2">
              <div className={clsx(baseClasses, "h-4 w-3/4")}></div>
              <div className={clsx(baseClasses, "h-3 w-1/2")}></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className={clsx("space-y-3", className)}>
        {/* Table header */}
        <div className="flex space-x-4 pb-2 border-b border-gray-200">
          <div className={clsx(baseClasses, "h-4 w-24")}></div>
          <div className={clsx(baseClasses, "h-4 w-32")}></div>
          <div className={clsx(baseClasses, "h-4 w-20")}></div>
          <div className={clsx(baseClasses, "h-4 w-28")}></div>
        </div>
        {/* Table rows */}
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex space-x-4 py-2">
            <div className={clsx(baseClasses, "h-4 w-24")}></div>
            <div className={clsx(baseClasses, "h-4 w-32")}></div>
            <div className={clsx(baseClasses, "h-4 w-20")}></div>
            <div className={clsx(baseClasses, "h-4 w-28")}></div>
          </div>
        ))}
      </div>
    );
  }

  // Default text variant
  return (
    <div className={clsx("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={clsx(
            baseClasses,
            "h-4",
            i === lines - 1 ? "w-5/6" : "w-full"
          )}
        ></div>
      ))}
    </div>
  );
});

