"use client";

import { FiAlertCircle, FiRefreshCw } from "react-icons/fi";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/Dialog";

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
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="relative max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl ring-1 ring-black/[0.04] dark:border-gray-700 dark:bg-card dark:ring-white/5 sm:rounded-2xl">
        {/* Icon */}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-blue-200/60 bg-blue-100 dark:border-blue-800/40 dark:bg-blue-900/30">
          <FiAlertCircle className="h-6 w-6 text-blue-600 dark:text-blue-300" />
        </div>

        {/* Content */}
        <div className="mb-6 text-center">
          <DialogTitle className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
            Resubmit Lead Magnet?
          </DialogTitle>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            This will create a new job with the same submission data. The original
            job will remain unchanged.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isResubmitting}
            className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isResubmitting}
            className="flex flex-1 items-center justify-center rounded-xl bg-primary-600 px-4 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isResubmitting ? (
              <>
                <FiRefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Resubmitting...
              </>
            ) : (
              <>
                <FiRefreshCw className="mr-2 h-4 w-4" />
                Resubmit
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
