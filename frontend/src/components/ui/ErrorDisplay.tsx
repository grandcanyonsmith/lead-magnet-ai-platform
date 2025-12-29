/**
 * Error display component with user-friendly messages and actions
 */

import React from "react";
import { AlertCircle, RefreshCw, ArrowLeft, LogIn } from "lucide-react";
import { getErrorMessage, isRetryableError } from "@/utils/errorMessages";
import clsx from "clsx";

interface ErrorDisplayProps {
  error: unknown;
  onRetry?: () => void;
  onGoBack?: () => void;
  onSignIn?: () => void;
  className?: string;
  variant?: "inline" | "card" | "full";
  showDetails?: boolean;
}

export const ErrorDisplay = React.memo(function ErrorDisplay({
  error,
  onRetry,
  onGoBack,
  onSignIn,
  className = "",
  variant = "card",
  showDetails = false,
}: ErrorDisplayProps) {
  const errorMessage = getErrorMessage(error);
  const canRetry = isRetryableError(error) && onRetry;

  const handleAction = () => {
    switch (errorMessage.action) {
      case "retry":
        onRetry?.();
        break;
      case "navigate":
      case "goBack":
        onGoBack?.();
        break;
      case "signin":
        onSignIn?.();
        break;
      case "refresh":
        window.location.reload();
        break;
      default:
        onRetry?.();
    }
  };

  const getActionIcon = () => {
    switch (errorMessage.action) {
      case "retry":
        return <RefreshCw className="h-4 w-4" />;
      case "navigate":
      case "goBack":
        return <ArrowLeft className="h-4 w-4" />;
      case "signin":
        return <LogIn className="h-4 w-4" />;
      default:
        return <RefreshCw className="h-4 w-4" />;
    }
  };

  if (variant === "inline") {
    return (
      <div
        className={clsx(
          "flex items-start space-x-3 p-3 bg-red-50 border border-red-200 rounded-lg",
          className
        )}
        role="alert"
        aria-live="polite"
      >
        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-900">
            {errorMessage.title}
          </p>
          <p className="text-sm text-red-700 mt-1">{errorMessage.message}</p>
          {canRetry && errorMessage.actionLabel && (
            <button
              onClick={handleAction}
              className="mt-2 text-sm font-medium text-red-700 hover:text-red-900 underline flex items-center space-x-1"
            >
              {getActionIcon()}
              <span>{errorMessage.actionLabel}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (variant === "full") {
    return (
      <div
        className={clsx(
          "min-h-screen flex items-center justify-center bg-gray-50 px-4",
          className
        )}
      >
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {errorMessage.title}
          </h2>
          <p className="text-gray-600 mb-6">{errorMessage.message}</p>
          {canRetry && errorMessage.actionLabel && (
            <button
              onClick={handleAction}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              {getActionIcon()}
              <span>{errorMessage.actionLabel}</span>
            </button>
          )}
          {onGoBack && (
            <button
              onClick={onGoBack}
              className="mt-3 text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Go back
            </button>
          )}
        </div>
      </div>
    );
  }

  // Default card variant
  return (
    <div
      className={clsx(
        "bg-white rounded-lg shadow-sm border border-red-200 p-6",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-red-100">
            <AlertCircle className="h-5 w-5 text-red-600" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {errorMessage.title}
          </h3>
          <p className="text-gray-600 mb-4">{errorMessage.message}</p>
          <div className="flex items-center space-x-3">
            {canRetry && errorMessage.actionLabel && (
              <button
                onClick={handleAction}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                {getActionIcon()}
                <span>{errorMessage.actionLabel}</span>
              </button>
            )}
            {onGoBack && (
              <button
                onClick={onGoBack}
                className="text-sm text-gray-600 hover:text-gray-900 underline"
              >
                Go back
              </button>
            )}
          </div>
          {showDetails && error instanceof Error && (
            <details className="mt-4">
              <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                Technical details
              </summary>
              <pre className="mt-2 p-3 bg-gray-50 rounded text-xs text-gray-700 overflow-auto">
                {error.stack || error.message}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
});

