"use client";

import { Fragment, useState } from "react";
import { FiX, FiSave, FiLoader, FiZap } from "react-icons/fi";
import { api } from "@/lib/api";
import { toast } from "react-hot-toast";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { PanelHeader } from "@/components/ui/PanelHeader";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";

interface QuickEditStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  stepOrder: number;
  stepName: string;
  onSave?: () => void;
}

export function QuickEditStepModal({
  isOpen,
  onClose,
  jobId,
  stepOrder,
  stepName,
  onSave,
}: QuickEditStepModalProps) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [proposedChanges, setProposedChanges] = useState<{
    original_output: any;
    edited_output: any;
    changes_summary: string;
  } | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt describing the changes you want");
      return;
    }

    setGenerating(true);
    setProposedChanges(null);

    try {
      const result = await api.quickEditStep(
        jobId,
        stepOrder,
        prompt.trim(),
        false,
      );
      setProposedChanges(result);
      toast.success("Changes generated successfully");
    } catch (error: any) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to generate changes:", error);
      }
      toast.error(error.message || "Failed to generate changes");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!prompt.trim() || !proposedChanges) {
      return;
    }

    setSaving(true);

    try {
      await api.quickEditStep(jobId, stepOrder, prompt.trim(), true);
      toast.success("Changes saved successfully");
      setProposedChanges(null);
      setPrompt("");
      onSave?.();
      onClose();
    } catch (error: any) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to save changes:", error);
      }
      toast.error(error.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!generating && !saving) {
      setPrompt("");
      setProposedChanges(null);
      onClose();
    }
  };

  const formatOutput = (output: any): string => {
    if (typeof output === "string") {
      return output;
    }
    return JSON.stringify(output, null, 2);
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
          <div className="flex min-h-screen items-center justify-center p-4">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="relative z-50 w-full max-w-4xl bg-white dark:bg-card rounded-lg shadow-xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <PanelHeader className="px-6 py-4 border-gray-200 dark:border-gray-700 bg-white dark:bg-card flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <FiZap className="w-5 h-5 text-purple-600" />
                    <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                      Quick Edit Step
                    </DialogTitle>
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={generating || saving}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </PanelHeader>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Step Info */}
            <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-700 dark:text-gray-200">
                <span className="font-medium">Step {stepOrder}:</span>{" "}
                {stepName}
              </p>
            </div>

            {/* Prompt Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Describe the changes you want to make
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g., Make the tone more professional, Add more details about X, Fix grammar errors..."
                disabled={generating || saving}
              />
            </div>

            {/* Generate Button */}
            {!proposedChanges && (
              <div className="flex justify-end">
                <button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || generating || saving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <>
                      <FiLoader className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FiZap className="w-4 h-4" />
                      Generate Changes
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Proposed Changes */}
            {proposedChanges && (
              <div className="space-y-4">
                {/* Changes Summary */}
                <AlertBanner
                  variant="info"
                  title="Summary"
                  description={proposedChanges.changes_summary}
                />

                {/* Before/After Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Original */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        Original Output
                      </span>
                    </div>
                    <div className="p-4 bg-white dark:bg-card max-h-96 overflow-y-auto">
                      {typeof proposedChanges.original_output === "string" ? (
                        <pre className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words font-mono">
                          {proposedChanges.original_output}
                        </pre>
                      ) : (
                        <JsonViewer
                          value={proposedChanges.original_output}
                          raw={formatOutput(proposedChanges.original_output)}
                          defaultMode="tree"
                          defaultExpandedDepth={2}
                        />
                      )}
                    </div>
                  </div>

                  {/* Edited */}
                  <div className="border border-green-200 dark:border-green-900/40 rounded-lg overflow-hidden">
                    <div className="bg-green-50 dark:bg-green-900/20 px-4 py-2 border-b border-green-200 dark:border-green-900/40">
                      <span className="text-sm font-semibold text-green-700 dark:text-green-200">
                        Edited Output
                      </span>
                    </div>
                    <div className="p-4 bg-white dark:bg-card max-h-96 overflow-y-auto">
                      {typeof proposedChanges.edited_output === "string" ? (
                        <pre className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words font-mono">
                          {proposedChanges.edited_output}
                        </pre>
                      ) : (
                        <JsonViewer
                          value={proposedChanges.edited_output}
                          raw={formatOutput(proposedChanges.edited_output)}
                          defaultMode="tree"
                          defaultExpandedDepth={2}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setProposedChanges(null);
                      setPrompt("");
                    }}
                    disabled={saving}
                    className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    Start Over
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <FiLoader className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <FiSave className="w-4 h-4" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
