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
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isResubmitting}
          >
            <FiX className="w-5 h-5" />
          </button>

          {/* Icon */}
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-blue-100 rounded-full">
            <FiAlertCircle className="w-6 h-6 text-blue-600" />
          </div>

          {/* Content */}
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Resubmit Lead Magnet?
            </h3>
            <p className="text-sm text-gray-600">
              This will create a new job with the same submission data. The
              original job will remain unchanged.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isResubmitting}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isResubmitting}
              className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center"
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
