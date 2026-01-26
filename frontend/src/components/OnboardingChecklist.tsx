"use client";

/**
 * OnboardingChecklist Component
 *
 * A widget that guides users through the initial onboarding process.
 * Features:
 * - Progress tracking
 * - Navigation with tour integration
 * - Error handling with retry
 * - Accessibility support
 * - Persistent state
 */

import { useMemo, useCallback, useRef, memo } from "react";
import {
  FiCheckCircle,
  FiCircle,
  FiX,
  FiList,
  FiChevronUp,
  FiChevronDown,
  FiArrowRight,
  FiRotateCcw,
} from "react-icons/fi";
import confetti from "canvas-confetti";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { OnboardingChecklistProps } from "./OnboardingChecklist/types";
import {
  CHECKLIST_ITEMS,
  DEFAULT_CHECKLIST_STATE,
  COMPLETION_MESSAGES,
  WIDGET_CONFIG,
} from "./OnboardingChecklist/constants";
import {
  calculateProgress,
  areAllItemsCompleted,
  getDefaultChecklist,
} from "./OnboardingChecklist/utils";
import {
  useWidgetState,
  useChecklistItemHandler,
} from "./OnboardingChecklist/hooks";

/**
 * Icon components for better maintainability
 */
const MinimizeIcon = ({ isMinimized }: { isMinimized: boolean }) => {
  return isMinimized ? (
    <FiChevronUp className="w-4 h-4" aria-hidden="true" />
  ) : (
    <FiChevronDown className="w-4 h-4" aria-hidden="true" />
  );
};

const LoadingSpinner = () => (
  <svg
    className="animate-spin h-4 w-4 text-primary-600"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

function OnboardingChecklistComponent({
  settings,
  onStartTour,
  onDismiss,
  onItemClick,
}: OnboardingChecklistProps) {
  const widgetRef = useRef<HTMLDivElement>(null);
  const {
    isOpen,
    isMinimized,
    setIsMinimized,
    handleDismiss,
    handleUndoDismiss,
    handleToggleMinimize,
  } = useWidgetState();

  // Memoize checklist state
  const checklist = useMemo(
    () => settings.onboarding_checklist || getDefaultChecklist(),
    [settings.onboarding_checklist],
  );

  // Memoize completion calculations
  const allCompleted = useMemo(
    () => areAllItemsCompleted(checklist),
    [checklist],
  );
  const progress = useMemo(() => calculateProgress(checklist), [checklist]);

  // Error handler for toast notifications
  const handleError = useCallback((error: string) => {
    toast.error(error, {
      duration: 5000,
      id: "onboarding-checklist-error",
    });
  }, []);

  // Checklist item click handler
  const { handleItemClick, itemState, clearError } = useChecklistItemHandler(
    onStartTour,
    handleError,
  );

  // Handle item click with callback
  const onItemClickHandler = useCallback(
    (item: (typeof CHECKLIST_ITEMS)[0]) => {
      onItemClick?.(item.id);
      handleItemClick(item);
      setIsMinimized(true); // Minimize when navigating
    },
    [handleItemClick, onItemClick, setIsMinimized],
  );

  // Trigger confetti when all items are completed
  useEffect(() => {
    if (allCompleted && isOpen) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        zIndex: 60, // Above the widget
      });
    }
  }, [allCompleted, isOpen]);

  // Handle dismiss with callback
  const onDismissHandler = useCallback(() => {
    handleDismiss();
    onDismiss?.();
    toast.success(
      (t) => (
        <div className="flex items-center gap-2">
          <span>Checklist dismissed.</span>
          <button
            onClick={() => {
              handleUndoDismiss();
              toast.dismiss(t.id);
              toast.success("Checklist restored", { duration: 2000 });
            }}
            className="underline font-medium hover:no-underline"
            type="button"
          >
            Undo
          </button>
        </div>
      ),
      {
        duration: 5000,
        id: "onboarding-checklist-dismissed",
      },
    );
  }, [handleDismiss, handleUndoDismiss, onDismiss]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, action: () => void) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        action();
      }
    },
    [],
  );

  // Don't show if survey not completed
  if (!settings.onboarding_survey_completed) {
    return null;
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={widgetRef}
      role="complementary"
      aria-label="Onboarding checklist"
      className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-50 bg-white rounded-lg shadow-xl border border-gray-200 transition-all duration-300 ${
        isMinimized ? "w-auto sm:w-64" : "w-full sm:w-80"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-white">
        <div className="flex items-center">
          <FiList
            className="w-5 h-5 text-primary-600 mr-2"
            aria-hidden="true"
          />
          <h3 className="font-semibold text-gray-900">Getting Started</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleMinimize}
            onKeyDown={(e) => handleKeyDown(e, handleToggleMinimize)}
            className="text-gray-500 hover:text-gray-700 p-2 rounded hover:bg-gray-100 touch-target transition-colors"
            aria-label={isMinimized ? "Expand checklist" : "Minimize checklist"}
            aria-expanded={!isMinimized}
            type="button"
          >
            <MinimizeIcon isMinimized={isMinimized} />
          </button>
          <button
            onClick={onDismissHandler}
            onKeyDown={(e) => handleKeyDown(e, onDismissHandler)}
            className="text-gray-500 hover:text-gray-700 p-2 rounded hover:bg-gray-100 touch-target transition-colors"
            aria-label="Dismiss checklist"
            title="Dismiss checklist"
            type="button"
          >
            <FiX className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="p-4">
          {/* Progress indicator */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">
                Progress
              </span>
              <span className="text-sm font-medium text-gray-600">
                {progress}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${progress}% complete`}
              />
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 mb-4">
            Complete these steps to get the most out of Lead Magnet AI:
          </p>

          {/* Error message */}
          {itemState.error && (
            <div
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg"
              role="alert"
              aria-live="polite"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-red-700">{itemState.error}</p>
                <button
                  onClick={clearError}
                  className="text-red-600 hover:text-red-800 p-1 rounded"
                  aria-label="Dismiss error"
                  type="button"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Checklist items */}
          <ul className="space-y-3" role="list">
            {CHECKLIST_ITEMS.map((item, index) => {
              const completed = checklist[item.id] || false;
              const isUpdating = itemState.updating === item.id;
              // Find the first incomplete item index to highlight the next step
              const firstIncompleteIndex = CHECKLIST_ITEMS.findIndex(
                (i) => !checklist[i.id],
              );
              const isNext = !completed && index === firstIncompleteIndex;

              return (
                <li key={item.id} role="listitem">
                  <button
                    onClick={() => onItemClickHandler(item)}
                    onKeyDown={(e) =>
                      handleKeyDown(e, () => onItemClickHandler(item))
                    }
                    disabled={completed || isUpdating}
                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-all border ${
                      completed
                        ? "bg-green-50 border-green-100 text-green-700 cursor-default"
                        : isUpdating
                          ? "bg-gray-50 border-gray-200 text-gray-500 cursor-wait"
                          : isNext
                            ? "bg-white border-primary-500 shadow-sm text-gray-900 hover:bg-primary-50 cursor-pointer ring-1 ring-primary-500"
                            : "bg-gray-50 border-transparent hover:bg-primary-50 text-gray-700 hover:text-primary-700 cursor-pointer"
                    }`}
                    aria-label={
                      completed
                        ? `${item.label} - Completed`
                        : isUpdating
                          ? `${item.label} - Loading`
                          : item.label
                    }
                    aria-disabled={completed || isUpdating}
                    type="button"
                  >
                    <div className="flex items-center flex-1 text-left">
                      {completed ? (
                        <FiCheckCircle
                          className="w-5 h-5 text-green-600 mr-3 flex-shrink-0"
                          aria-hidden="true"
                        />
                      ) : (
                        <FiCircle
                          className={`w-5 h-5 mr-3 flex-shrink-0 ${
                            isNext ? "text-primary-600" : "text-gray-400"
                          }`}
                          aria-hidden="true"
                        />
                      )}
                      <div className="flex flex-col">
                        <span className={`text-sm font-medium ${isNext ? "text-primary-900" : ""}`}>
                          {item.label}
                        </span>
                        {isNext && (
                          <span className="text-xs text-gray-500 mt-0.5">
                            {item.description}
                          </span>
                        )}
                      </div>
                    </div>
                    {!completed && !isUpdating && (
                      <FiArrowRight
                        className="w-4 h-4 ml-2 flex-shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    {isUpdating && <LoadingSpinner />}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Completion message */}
          {allCompleted && (
            <div
              className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200 text-center animate-fade-in"
              role="status"
              aria-live="polite"
            >
              <div className="flex justify-center mb-2">
                <div className="p-2 bg-green-100 rounded-full">
                  <FiCheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <h4 className="text-green-800 font-semibold mb-1">Congratulations!</h4>
              <p className="text-sm text-green-700 mb-3">
                {COMPLETION_MESSAGES.ALL_COMPLETE}
              </p>
              <button
                onClick={onDismissHandler}
                className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md transition-colors font-medium"
              >
                Close Checklist
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export const OnboardingChecklist = memo(OnboardingChecklistComponent);
