"use client";

import { FiAlertCircle, FiRefreshCw, FiPlay } from "react-icons/fi";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/Dialog";

interface RerunStepDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRerunOnly: () => void;
  onRerunAndContinue: () => void;
  stepNumber: number;
  stepName?: string;
  isRerunning: boolean;
}

export function RerunStepDialog({
  isOpen,
  onClose,
  onRerunOnly,
  onRerunAndContinue,
  stepNumber,
  stepName,
  isRerunning,
}: RerunStepDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="relative max-w-md bg-white p-6 sm:rounded-lg">
        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-blue-100 rounded-full">
          <FiAlertCircle className="w-6 h-6 text-blue-600" />
        </div>

        {/* Content */}
        <div className="text-center mb-6">
          <DialogTitle className="text-lg font-semibold text-gray-900 mb-2">
            Rerun Step {stepNumber}?
          </DialogTitle>
          {stepName && (
            <p className="text-sm text-gray-600 mb-3 font-medium">{stepName}</p>
          )}
          <p className="text-sm text-gray-600">Choose how you want to proceed:</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onRerunOnly}
            disabled={isRerunning}
            className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center"
          >
            {isRerunning ? (
              <>
                <FiRefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Rerunning...
              </>
            ) : (
              <>
                <FiRefreshCw className="w-4 h-4 mr-2" />
                Rerun Step Only
              </>
            )}
          </button>
          <button
            onClick={onRerunAndContinue}
            disabled={isRerunning}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center"
          >
            {isRerunning ? (
              <>
                <FiRefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Rerunning...
              </>
            ) : (
              <>
                <FiPlay className="w-4 h-4 mr-2" />
                Rerun Step & Continue
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isRerunning}
            className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
