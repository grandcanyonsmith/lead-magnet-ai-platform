"use client";

import { FiAlertCircle, FiX, FiRefreshCw } from "react-icons/fi";

interface ResubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isResubmitting: boolean;
}

export function ResubmitModal({
  isOpen,
  onClose,
  onConfirm,
  isResubmitting,
}: ResubmitModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative max-w-md w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-card shadow-xl p-6 ring-1 ring-black/[0.04] dark:ring-white/5">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full border border-transparent p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            disabled={isResubmitting}
            aria-label="Close"
          >
            <FiX className="w-5 h-5" />
          </button>

          {/* Icon */}
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30 rounded-full border border-blue-200/60 dark:border-blue-800/40">
            <FiAlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-300" />
          </div>

          {/* Content */}
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Resubmit Lead Magnet?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              This will create a new job with the same submission data. The
              original job will remain unchanged.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isResubmitting}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isResubmitting}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center shadow-sm"
            >
              {isResubmitting ? (
                <>
                  <FiRefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Resubmitting...
                </>
              ) : (
                <>
                  <FiRefreshCw className="w-4 h-4 mr-2" />
                  Resubmit
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
