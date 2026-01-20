import React from "react";
import type { WorkflowAIEditResponse } from "@/types/workflow";

interface WorkflowDiffPreviewProps {
  currentWorkflow: {
    workflow_name: string;
    workflow_description?: string;
    steps: any[];
  };
  proposal: WorkflowAIEditResponse;
  onAccept: () => void;
  onReject: () => void;
  isApplying?: boolean;
  showActions?: boolean;
  acceptLabel?: string;
  rejectLabel?: string;
  actionsDisabled?: boolean;
}

export function WorkflowDiffPreview({
  currentWorkflow,
  proposal,
  onAccept,
  onReject,
  isApplying = false,
  showActions = true,
  acceptLabel = "Apply Changes",
  rejectLabel = "Reject",
  actionsDisabled = false,
}: WorkflowDiffPreviewProps) {
  const isActionDisabled = isApplying || actionsDisabled;
  const hasNameChange =
    proposal.workflow_name &&
    proposal.workflow_name !== currentWorkflow.workflow_name;
  const hasDescriptionChange =
    proposal.workflow_description !== undefined &&
    proposal.workflow_description !== currentWorkflow.workflow_description;

  return (
    <div className="min-w-0 bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            AI-Generated Changes
          </h3>
          <p className="text-sm text-blue-700 mb-4 break-words">
            {proposal.changes_summary}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Workflow metadata changes */}
        {(hasNameChange || hasDescriptionChange) && (
          <div className="bg-white rounded-lg p-4 space-y-3 min-w-0">
            <h4 className="font-medium text-gray-900">Workflow Settings</h4>

            {hasNameChange && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-700">Name</div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 line-through break-words">
                    {currentWorkflow.workflow_name}
                  </div>
                  <span className="hidden text-gray-400 sm:inline">→</span>
                  <div className="min-w-0 flex-1 px-3 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700 font-medium break-words">
                    {proposal.workflow_name}
                  </div>
                </div>
              </div>
            )}

            {hasDescriptionChange && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-700">
                  Description
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 line-through break-words">
                    {currentWorkflow.workflow_description || "(empty)"}
                  </div>
                  <span className="hidden text-gray-400 sm:inline">→</span>
                  <div className="min-w-0 flex-1 px-3 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700 font-medium break-words">
                    {proposal.workflow_description || "(empty)"}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Steps comparison */}
        <div className="bg-white rounded-lg p-4 space-y-3 min-w-0">
          <h4 className="font-medium text-gray-900">
            Steps ({currentWorkflow.steps.length} → {proposal.steps.length})
          </h4>

          <div className="space-y-2">
            {proposal.steps.map((proposedStep, index) => {
              const currentStep = currentWorkflow.steps[index];
              const isNew = !currentStep;
              const isModified =
                currentStep &&
                (currentStep.step_name !== proposedStep.step_name ||
                  currentStep.step_description !==
                    proposedStep.step_description ||
                  currentStep.model !== proposedStep.model ||
                  currentStep.instructions !== proposedStep.instructions);

              return (
                <div
                  key={index}
                  className={`p-3 rounded-lg border-2 ${
                    isNew
                      ? "bg-green-50 border-green-300"
                      : isModified
                        ? "bg-yellow-50 border-yellow-300"
                        : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex min-w-0 flex-col">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">
                          Step {index + 1}
                        </span>
                        {isNew && (
                          <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded-full font-medium">
                            NEW
                          </span>
                        )}
                        {isModified && (
                          <span className="text-xs px-2 py-0.5 bg-yellow-600 text-white rounded-full font-medium">
                            MODIFIED
                          </span>
                        )}
                      </div>

                      <div className="mb-1 font-medium text-gray-900 break-words">
                        {proposedStep.step_name}
                      </div>

                      {proposedStep.step_description && (
                        <div className="mb-2 text-sm text-gray-600 break-words">
                          {proposedStep.step_description}
                        </div>
                      )}

                      <div className="flex min-w-0 flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span className="max-w-full break-words rounded border bg-white px-2 py-1">
                          {proposedStep.model}
                        </span>
                        {proposedStep.tools &&
                          proposedStep.tools.length > 0 && (
                            <span className="max-w-full break-words rounded border bg-white px-2 py-1">
                              {proposedStep.tools
                                .map((t: any) =>
                                  typeof t === "string" ? t : t.type,
                                )
                                .join(", ")}
                            </span>
                          )}
                        {proposedStep.depends_on &&
                          proposedStep.depends_on.length > 0 && (
                            <span className="max-w-full break-words rounded border bg-white px-2 py-1">
                              Depends on:{" "}
                              {proposedStep.depends_on
                                .map((d: number) => d + 1)
                                .join(", ")}
                            </span>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Show removed steps */}
          {currentWorkflow.steps.length > proposal.steps.length && (
            <div className="mt-3 p-3 bg-red-50 border-2 border-red-300 rounded-lg min-w-0">
              <div className="text-sm font-medium text-red-700 mb-2">
                Removed Steps (
                {currentWorkflow.steps.length - proposal.steps.length})
              </div>
              {currentWorkflow.steps
                .slice(proposal.steps.length)
                .map((step, index) => (
                  <div
                    key={index}
                    className="text-sm text-red-600 line-through break-words"
                  >
                    • {step.step_name}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {showActions && (
        <div className="flex flex-col gap-2 pt-2 border-t border-blue-200 sm:flex-row sm:items-center sm:justify-end">
          <button
            onClick={onReject}
            disabled={isActionDisabled}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {rejectLabel}
          </button>
          <button
            onClick={onAccept}
            disabled={isActionDisabled}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isApplying ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
                Applying...
              </>
            ) : (
              acceptLabel
            )}
          </button>
        </div>
      )}
    </div>
  );
}
