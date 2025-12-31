"use client";

import React, { useState } from "react";
import { FiZap, FiChevronDown, FiChevronUp } from "react-icons/fi";
import StepDiffPreview from "@/components/workflows/edit/StepDiffPreview";
import { WorkflowStep } from "@/types/workflow";
import toast from "react-hot-toast";

interface AIAssistProps {
  workflowId?: string;
  step: WorkflowStep;
  index: number;
  useWorkflowStepAI: any; // Using the hook return type would be better if exported
  onAccept: (proposed: WorkflowStep) => void;
}

export default function AIAssist({
  workflowId,
  step,
  index,
  useWorkflowStepAI,
  onAccept,
}: AIAssistProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  const {
    isGenerating,
    error: aiError,
    proposal,
    generateStep,
    acceptProposal,
    rejectProposal,
  } = useWorkflowStepAI;

  if (!workflowId) return null;

  const handleAIGenerate = async () => {
    if (!generateStep || !aiPrompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    try {
      await generateStep(aiPrompt, step, index, "update");
    } catch (err: any) {
      toast.error(aiError || "Failed to generate step configuration");
    }
  };

  const handleAcceptProposal = () => {
    if (!proposal || !acceptProposal) return;

    const acceptedProposal = acceptProposal();
    if (acceptedProposal) {
      const { proposed } = acceptedProposal;
      onAccept(proposed);
      setAiPrompt("");
      toast.success("AI changes applied successfully");
    }
  };

  const handleRejectProposal = () => {
    if (!rejectProposal) return;
    rejectProposal();
    setAiPrompt("");
    toast("AI proposal rejected");
  };

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 border border-purple-200 dark:border-purple-800 rounded-lg hover:from-purple-100 hover:to-blue-100 dark:hover:from-purple-900/40 dark:hover:to-blue-900/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FiZap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <span className="font-semibold text-purple-900 dark:text-purple-200">AI Assist</span>
          <span className="text-xs text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50 px-2 py-1 rounded-full">
            Beta
          </span>
        </div>
        {isOpen ? (
          <FiChevronUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        ) : (
          <FiChevronDown className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        )}
      </button>

      {isOpen && (
        <div className="mt-3 p-4 border border-purple-200 dark:border-purple-800 rounded-lg bg-white dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Describe how you want to change this step, and AI will generate an
            updated configuration for you to review.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                What would you like to change?
              </label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g., 'Change the model to GPT-4o and add web search tool' or 'Update instructions to focus on competitive analysis'"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                rows={3}
                disabled={isGenerating}
              />
            </div>

            <button
              type="button"
              onClick={handleAIGenerate}
              disabled={!aiPrompt.trim() || isGenerating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FiZap className="w-4 h-4" />
                  Generate with AI
                </>
              )}
            </button>

            {aiError && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded border border-red-200 dark:border-red-900">
                {aiError}
              </div>
            )}

            {proposal && (
              <div className="mt-4">
                <StepDiffPreview
                  original={proposal.original}
                  proposed={proposal.proposed}
                  action={proposal.action}
                  onAccept={handleAcceptProposal}
                  onReject={handleRejectProposal}
                  isLoading={false}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

