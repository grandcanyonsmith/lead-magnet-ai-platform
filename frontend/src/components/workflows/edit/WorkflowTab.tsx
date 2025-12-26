"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiSave, FiZap } from "react-icons/fi";
import WorkflowFlowchart from "@/app/dashboard/workflows/components/WorkflowFlowchart";
import FlowchartSidePanel from "@/app/dashboard/workflows/components/FlowchartSidePanel";
import { WorkflowFormData } from "@/hooks/useWorkflowEdit";
import { WorkflowStep } from "@/types/workflow";
import { useWorkflowAI } from "@/hooks/useWorkflowAI";
import { WorkflowDiffPreview } from "./WorkflowDiffPreview";
import toast from "react-hot-toast";

interface WorkflowTabProps {
  workflowId: string;
  formData: WorkflowFormData;
  steps: WorkflowStep[];
  submitting: boolean;
  selectedStepIndex: number | null;
  isSidePanelOpen: boolean;
  onFormDataChange: (field: string, value: any) => void;
  onStepsChange: (newSteps: WorkflowStep[]) => void;
  onAddStep: () => void;
  onStepClick: (index: number) => void;
  onStepsReorder: (newSteps: WorkflowStep[]) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onDeleteStep?: (index: number) => void;
  onMoveStepUp?: (index: number) => void;
  onMoveStepDown?: (index: number) => void;
}

export function WorkflowTab({
  workflowId,
  formData,
  steps,
  submitting,
  selectedStepIndex,
  isSidePanelOpen,
  onFormDataChange,
  onStepsChange,
  onAddStep,
  onStepClick,
  onStepsReorder,
  onSubmit,
  onCancel,
  onDeleteStep,
  onMoveStepUp,
  onMoveStepDown,
}: WorkflowTabProps) {
  const [showAIAssist, setShowAIAssist] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  const {
    generateWorkflowEdit,
    clearProposal,
    isGenerating,
    error: aiError,
    proposal,
  } = useWorkflowAI(workflowId);

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error(
        "Please enter a description of how you want to change the workflow",
      );
      return;
    }

    try {
      await generateWorkflowEdit(aiPrompt);
      toast.success("AI proposal generated successfully!");
    } catch (err) {
      toast.error("Failed to generate AI proposal");
    }
  };

  const handleAcceptProposal = async () => {
    if (!proposal) return;

    setIsApplying(true);
    try {
      // Validate proposal steps before applying
      if (!proposal.steps || !Array.isArray(proposal.steps)) {
        throw new Error("Invalid proposal: steps must be an array");
      }

      // Validate each step has required fields
      for (let i = 0; i < proposal.steps.length; i++) {
        const step = proposal.steps[i];
        if (!step.step_name || !step.instructions) {
          throw new Error(
            `Invalid step ${i + 1}: missing required fields (step_name or instructions)`,
          );
        }
        // Model is required but backend will default to 'gpt-5.2' if missing
        // We don't need to validate it here as the backend handles defaults
      }

      // Apply workflow metadata changes
      if (proposal.workflow_name) {
        onFormDataChange("workflow_name", proposal.workflow_name);
      }
      if (proposal.workflow_description !== undefined) {
        onFormDataChange("workflow_description", proposal.workflow_description);
      }

      // Apply validated step changes
      onStepsChange(proposal.steps);

      toast.success("AI changes applied! Don't forget to save.");
      clearProposal();
      setAiPrompt("");
      setShowAIAssist(false);
    } catch (err: any) {
      console.error("[WorkflowTab] Failed to apply AI proposal", err);
      toast.error(err.message || "Failed to apply changes");
      // Don't clear proposal on error so user can try again or reject
    } finally {
      setIsApplying(false);
    }
  };

  const handleRejectProposal = () => {
    clearProposal();
    toast("Proposal rejected", { icon: "❌" });
  };

  const handleStepChange = (index: number, updatedStep: WorkflowStep) => {
    const newSteps = [...steps];
    newSteps[index] = updatedStep;
    onStepsChange(newSteps);
  };

  const handleDeleteStep = (index: number) => {
    if (onDeleteStep) {
      onDeleteStep(index);
    } else {
      const newSteps = steps.filter((_, i) => i !== index);
      onStepsChange(newSteps);
    }
  };

  const handleMoveStepUp = (index: number) => {
    if (index === 0) return;
    if (onMoveStepUp) {
      onMoveStepUp(index);
    } else {
      const newSteps = [...steps];
      [newSteps[index - 1], newSteps[index]] = [
        newSteps[index],
        newSteps[index - 1],
      ];
      onStepsChange(newSteps);
    }
  };

  const handleMoveStepDown = (index: number) => {
    if (index === steps.length - 1) return;
    if (onMoveStepDown) {
      onMoveStepDown(index);
    } else {
      const newSteps = [...steps];
      [newSteps[index], newSteps[index + 1]] = [
        newSteps[index + 1],
        newSteps[index],
      ];
      onStepsChange(newSteps);
    }
  };

  const handleCloseSidePanel = () => {
    onStepClick(-1); // Pass -1 to close the panel
  };

  const selectedStep =
    selectedStepIndex !== null && selectedStepIndex >= 0
      ? steps[selectedStepIndex]
      : null;

  return (
    <>
      <form
        onSubmit={onSubmit}
        className="bg-white rounded-lg shadow p-6 space-y-6"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Lead Magnet Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.workflow_name}
            onChange={(e) => onFormDataChange("workflow_name", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Course Idea Validator"
            maxLength={200}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={formData.workflow_description}
            onChange={(e) =>
              onFormDataChange("workflow_description", e.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Describe what this lead magnet does (e.g., validates course ideas and provides market research)..."
            rows={3}
            maxLength={1000}
          />
        </div>

        {/* AI Workflow Assistant */}
        <div className="pt-6 border-t">
          <button
            type="button"
            onClick={() => setShowAIAssist(!showAIAssist)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg hover:from-purple-100 hover:to-blue-100 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <FiZap className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900">
                  AI Workflow Assistant
                </h3>
                <p className="text-sm text-gray-600">
                  Restructure your entire workflow with AI
                </p>
              </div>
            </div>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${showAIAssist ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showAIAssist && (
            <div className="mt-4 p-6 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
              {!proposal ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      What would you like to change?
                    </label>
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Examples:&#10;• Add a research step at the beginning using web search&#10;• Simplify this to just 3 main steps&#10;• Change all steps to use GPT-5&#10;• Remove step 2 and combine steps 3 and 4"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      rows={4}
                      disabled={isGenerating}
                    />
                  </div>

                  {aiError && (
                    <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      {aiError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleGenerateAI}
                    disabled={isGenerating || !aiPrompt.trim()}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isGenerating ? (
                      <>
                        <svg
                          className="animate-spin h-5 w-5"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        <FiZap className="w-5 h-5" />
                        Generate AI Proposal
                      </>
                    )}
                  </button>
                </>
              ) : (
                <WorkflowDiffPreview
                  currentWorkflow={{
                    workflow_name: formData.workflow_name,
                    workflow_description: formData.workflow_description,
                    steps: steps,
                  }}
                  proposal={proposal}
                  onAccept={handleAcceptProposal}
                  onReject={handleRejectProposal}
                  isApplying={isApplying}
                />
              )}
            </div>
          )}
        </div>

        {/* Workflow Steps - Flowchart Visualization */}
        <div className="space-y-4 pt-6 border-t">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Workflow Steps
            </h2>
            <p className="text-sm text-gray-600">
              Define the steps your workflow will execute. Each step receives
              context from all previous steps. Click on a step to edit its
              details.
            </p>
          </div>

          <WorkflowFlowchart
            steps={steps}
            activeStepIndex={selectedStepIndex}
            onStepClick={onStepClick}
            onAddStep={onAddStep}
            onStepsReorder={(newSteps) => {
              const reorderedSteps = newSteps.map((step, index) => ({
                ...step,
                step_order: index,
              }));
              onStepsReorder(reorderedSteps);
            }}
          />
        </div>

        {formData.template_id && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Templates are managed in the Template tab
              above.
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors touch-target"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target"
          >
            <FiSave className="w-5 h-5 mr-2" />
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>

      {/* Step Editor Side Panel */}
      {selectedStepIndex !== null && selectedStepIndex >= 0 && (
        <FlowchartSidePanel
          step={selectedStep}
          index={selectedStepIndex}
          totalSteps={steps.length}
          allSteps={steps}
          isOpen={isSidePanelOpen}
          onClose={handleCloseSidePanel}
          onChange={handleStepChange}
          onDelete={handleDeleteStep}
          onMoveUp={handleMoveStepUp}
          onMoveDown={handleMoveStepDown}
          workflowId={workflowId}
        />
      )}
    </>
  );
}
