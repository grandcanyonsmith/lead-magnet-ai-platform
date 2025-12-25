"use client";

import { useState } from "react";
import { FiX, FiSave, FiLoader, FiZap } from "react-icons/fi";
import { api } from "@/lib/api";
import { toast } from "react-hot-toast";

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

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="relative z-50 w-full max-w-4xl bg-white rounded-lg shadow-xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              <FiZap className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Quick Edit Step
              </h3>
            </div>
            <button
              onClick={handleClose}
              disabled={generating || saving}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Step Info */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Step {stepOrder}:</span>{" "}
                {stepName}
              </p>
            </div>

            {/* Prompt Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Describe the changes you want to make
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Summary:</span>{" "}
                    {proposedChanges.changes_summary}
                  </p>
                </div>

                {/* Before/After Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Original */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <span className="text-sm font-semibold text-gray-700">
                        Original Output
                      </span>
                    </div>
                    <div className="p-4 bg-white max-h-96 overflow-y-auto">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                        {formatOutput(proposedChanges.original_output)}
                      </pre>
                    </div>
                  </div>

                  {/* Edited */}
                  <div className="border border-green-200 rounded-lg overflow-hidden">
                    <div className="bg-green-50 px-4 py-2 border-b border-green-200">
                      <span className="text-sm font-semibold text-green-700">
                        Edited Output
                      </span>
                    </div>
                    <div className="p-4 bg-white max-h-96 overflow-y-auto">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                        {formatOutput(proposedChanges.edited_output)}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setProposedChanges(null);
                      setPrompt("");
                    }}
                    disabled={saving}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
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
        </div>
      </div>
    </div>
  );
}
