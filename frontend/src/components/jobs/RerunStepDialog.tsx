"use client";

import { Fragment } from "react";
import { FiAlertCircle, FiX, FiRefreshCw, FiPlay } from "react-icons/fi";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";

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
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 transition-opacity" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={isRerunning}
                >
                  <FiX className="w-5 h-5" />
                </button>

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
                    <p className="text-sm text-gray-600 mb-3 font-medium">
                      {stepName}
                    </p>
                  )}
                  <p className="text-sm text-gray-600">
                    Choose how you want to proceed:
                  </p>
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
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
