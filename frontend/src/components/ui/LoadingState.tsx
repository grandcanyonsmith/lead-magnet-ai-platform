/**
 * Shared loading state component
 * Provides consistent loading UI across the app
 */

import React from "react";
import clsx from "clsx";

interface LoadingStateProps {
  message?: string;
  fullPage?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "spinner" | "dots" | "pulse";
}

export const LoadingState = React.memo(function LoadingState({
  message = "Loading...",
  fullPage = false,
  className = "",
  size = "md",
  variant = "spinner",
}: LoadingStateProps) {
  const containerClass = fullPage
    ? "flex items-center justify-center min-h-screen"
    : "flex items-center justify-center py-12";

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  const renderSpinner = () => (
    <div
      className={clsx(
        "inline-block animate-spin rounded-full border-b-2 border-primary-600 dark:border-primary",
        sizeClasses[size]
      )}
      aria-hidden="true"
    ></div>
  );

  const renderDots = () => (
    <div className="flex items-center space-x-2" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={clsx(
            "rounded-full bg-primary-600 dark:bg-primary animate-pulse",
            size === "sm" ? "h-2 w-2" : size === "md" ? "h-3 w-3" : "h-4 w-4"
          )}
          style={{
            animationDelay: `${i * 0.2}s`,
            animationDuration: "1.4s",
          }}
        ></div>
      ))}
    </div>
  );

  const renderPulse = () => (
    <div
      className={clsx(
        "rounded-full bg-primary-600 dark:bg-primary animate-pulse",
        sizeClasses[size]
      )}
      aria-hidden="true"
    ></div>
  );

  const renderLoader = () => {
    switch (variant) {
      case "dots":
        return renderDots();
      case "pulse":
        return renderPulse();
      default:
        return renderSpinner();
    }
  };

  return (
    <div
      className={clsx(containerClass, className)}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="text-center">
        <div className="mb-4 flex justify-center">{renderLoader()}</div>
        {message && (
          <p className="text-gray-600 dark:text-muted-foreground text-sm sm:text-base">{message}</p>
        )}
      </div>
    </div>
  );
});
