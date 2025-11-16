import React from 'react';
import { WorkflowAIEditResponse } from '@/features/workflows/hooks/useWorkflowAI';

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
}

export function WorkflowDiffPreview({
  currentWorkflow,
  proposal,
  onAccept,
  onReject,
  isApplying = false,
}: WorkflowDiffPreviewProps) {
  const hasNameChange = proposal.workflow_name && proposal.workflow_name !== currentWorkflow.workflow_name;
  const hasDescriptionChange = proposal.workflow_description !== undefined && 
    proposal.workflow_description !== currentWorkflow.workflow_description;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            AI-Generated Changes
          </h3>
          <p className="text-sm text-blue-700 mb-4">
            {proposal.changes_summary}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Workflow metadata changes */}
        {(hasNameChange || hasDescriptionChange) && (
          <div className="bg-white rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-gray-900">Workflow Settings</h4>
            
            {hasNameChange && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-700">Name</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 line-through">
                    {currentWorkflow.workflow_name}
                  </div>
                  <span className="text-gray-400">→</span>
                  <div className="flex-1 px-3 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700 font-medium">
                    {proposal.workflow_name}
                  </div>
                </div>
              </div>
            )}

            {hasDescriptionChange && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-700">Description</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 line-through">
                    {currentWorkflow.workflow_description || '(empty)'}
                  </div>
                  <span className="text-gray-400">→</span>
                  <div className="flex-1 px-3 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700 font-medium">
                    {proposal.workflow_description || '(empty)'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Steps comparison */}
        <div className="bg-white rounded-lg p-4 space-y-3">
          <h4 className="font-medium text-gray-900">
            Steps ({currentWorkflow.steps.length} → {proposal.steps.length})
          </h4>
          
          <div className="space-y-2">
            {proposal.steps.map((proposedStep, index) => {
              const currentStep = currentWorkflow.steps[index];
              const isNew = !currentStep;
              const isModified = currentStep && (
                currentStep.step_name !== proposedStep.step_name ||
                currentStep.step_description !== proposedStep.step_description ||
                currentStep.model !== proposedStep.model ||
                currentStep.instructions !== proposedStep.instructions
              );

              return (
                <div
                  key={index}
                  className={`p-3 rounded-lg border-2 ${
                    isNew
                      ? 'bg-green-50 border-green-300'
                      : isModified
                      ? 'bg-yellow-50 border-yellow-300'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
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
                      
                      <div className="font-medium text-gray-900 mb-1">
                        {proposedStep.step_name}
                      </div>
                      
                      {proposedStep.step_description && (
                        <div className="text-sm text-gray-600 mb-2">
                          {proposedStep.step_description}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="px-2 py-1 bg-white rounded border">
                          {proposedStep.model}
                        </span>
                        {proposedStep.tools && proposedStep.tools.length > 0 && (
                          <span className="px-2 py-1 bg-white rounded border">
                            {proposedStep.tools.map((t: any) => typeof t === 'string' ? t : t.type).join(', ')}
                          </span>
                        )}
                        {proposedStep.depends_on && proposedStep.depends_on.length > 0 && (
                          <span className="px-2 py-1 bg-white rounded border">
                            Depends on: {proposedStep.depends_on.map((d: number) => d + 1).join(', ')}
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
            <div className="mt-3 p-3 bg-red-50 border-2 border-red-300 rounded-lg">
              <div className="text-sm font-medium text-red-700 mb-2">
                Removed Steps ({currentWorkflow.steps.length - proposal.steps.length})
              </div>
              {currentWorkflow.steps.slice(proposal.steps.length).map((step, index) => (
                <div key={index} className="text-sm text-red-600 line-through">
                  • {step.step_name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-blue-200">
        <button
          onClick={onReject}
          disabled={isApplying}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reject
        </button>
        <button
          onClick={onAccept}
          disabled={isApplying}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isApplying ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Applying...
            </>
          ) : (
            'Apply Changes'
          )}
        </button>
      </div>
    </div>
  );
}
