"use client";

import { useState } from "react";
import { FiSave, FiLoader, FiZap } from "react-icons/fi";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/Dialog";

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
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="z-50 flex max-h-[90vh] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:rounded-lg">
        {/* Header */}
        <PanelHeader className="flex-shrink-0 border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-card">
          <div className="flex items-center gap-2">
            <FiZap className="w-5 h-5 text-purple-600" />
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
              Quick Edit Step
            </DialogTitle>
          </div>
        </PanelHeader>

        {/* Content */}
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {/* Step Info */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              <span className="font-medium">Step {stepOrder}:</span> {stepName}
            </p>
          </div>

          {/* Prompt Input */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Describe the changes you want to make
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
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
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <FiLoader className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FiZap className="h-4 w-4" />
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Original */}
                <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-900/50">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      Original Output
                    </span>
                  </div>
                  <div className="max-h-96 overflow-y-auto bg-white p-4 dark:bg-card">
                    {typeof proposedChanges.original_output === "string" ? (
                      <pre className="break-words font-mono text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-200">
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
                <div className="overflow-hidden rounded-lg border border-green-200 dark:border-green-900/40">
                  <div className="border-b border-green-200 bg-green-50 px-4 py-2 dark:border-green-900/40 dark:bg-green-900/20">
                    <span className="text-sm font-semibold text-green-700 dark:text-green-200">
                      Edited Output
                    </span>
                  </div>
                  <div className="max-h-96 overflow-y-auto bg-white p-4 dark:bg-card">
                    {typeof proposedChanges.edited_output === "string" ? (
                      <pre className="break-words font-mono text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-200">
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
              <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setProposedChanges(null);
                    setPrompt("");
                  }}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Start Over
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <FiLoader className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <FiSave className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
