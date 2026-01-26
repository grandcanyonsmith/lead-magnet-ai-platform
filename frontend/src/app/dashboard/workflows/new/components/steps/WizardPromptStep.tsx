import React from "react";
import { FiZap } from "react-icons/fi";
import { WizardStep } from "../../hooks/useNewWorkflowState";
import { AIModel } from "@/types";

interface WizardPromptStepProps {
  setStep: (step: WizardStep) => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  error: string | null;
  setError: (error: string | null) => void;
  aiGeneration: any; // Using any for now, but should be typed properly if possible
  resolvedModel: AIModel;
  setGenerationJobId: (id: string | null) => void;
  workflowForm: any;
  workflowSteps: any;
}

export const WizardPromptStep: React.FC<WizardPromptStepProps> = ({
  setStep,
  prompt,
  setPrompt,
  error,
  setError,
  aiGeneration,
  resolvedModel,
  setGenerationJobId,
  workflowForm,
  workflowSteps,
}) => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => setStep("choice")}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-muted-foreground dark:hover:text-foreground mb-4 flex items-center gap-1 transition-colors group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">
            ←
          </span>
          Back to options
        </button>
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg">
            <FiZap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-foreground mb-2">
              Describe Your Lead Magnet
            </h1>
            <p className="text-gray-600 dark:text-muted-foreground text-base leading-relaxed">
              Tell us what you want to build. We&apos;ll generate the structure,
              content, and configuration for you.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-card rounded-lg shadow-lg border border-gray-200 dark:border-border overflow-hidden">
        <div className="p-6 md:p-8 space-y-6">
          <div>
            <label
              htmlFor="prompt"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              What do you want to create?
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., I want a 5-day email course on how to launch a podcast, targeting busy professionals..."
              rows={6}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 focus:border-purple-500 dark:focus:border-purple-400 focus:ring-0 text-gray-900 dark:text-foreground bg-white dark:bg-gray-900 placeholder-gray-400 dark:placeholder-gray-500 transition-colors resize-none text-base"
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-muted-foreground">
              Be specific about your audience and the goal of the lead magnet.
            </p>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={async () => {
                if (!prompt.trim()) {
                  setError("Please describe what you want to build");
                  return;
                }
                setError(null);
                setStep("creating");

                try {
                  const result = await aiGeneration.generateWorkflow(
                    prompt,
                    resolvedModel,
                  );
                  if (result?.jobId) {
                    setGenerationJobId(result.jobId);
                  } else if (result?.workflow) {
                    // Direct result (legacy or fast path)
                    workflowForm.updateFormData({
                      workflow_name: result.workflow.workflow_name || "",
                      workflow_description: result.workflow.workflow_description || "",
                    });
                    workflowSteps.setSteps(result.workflow.steps);
                    if (result.workflow.templateData) {
                      workflowForm.updateTemplateData(
                        result.workflow.templateData,
                        undefined,
                      );
                    }
                    setStep("form");
                  }
                } catch (err: any) {
                  setError(err.message || "Failed to generate workflow");
                  setStep("prompt");
                }
              }}
              disabled={!prompt.trim() || aiGeneration.isGenerating}
              className="px-8 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center gap-2"
            >
              {aiGeneration.isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FiZap className="w-5 h-5" />
                  Generate Workflow
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
