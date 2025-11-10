'use client'

import { FiChevronDown, FiChevronUp } from 'react-icons/fi'

interface PreviousStep {
  step_order: number
  step_name: string
  output: any
  image_urls?: string[]
}

interface PreviousStepsContextProps {
  previousSteps: PreviousStep[]
  formSubmission?: any
  expandedPrevSteps: Set<number>
  onTogglePrevStep: (stepOrder: number) => void
  currentStepOrder: number
}

export function PreviousStepsContext({ 
  previousSteps, 
  formSubmission,
  expandedPrevSteps,
  onTogglePrevStep,
  currentStepOrder
}: PreviousStepsContextProps) {

  if (!previousSteps.length && !formSubmission) {
    return null
  }

  const getStepKey = (stepOrder: number) => `${currentStepOrder}-prev-${stepOrder}`

  return (
    <div className="space-y-2 mb-4">
      <div className="text-xs font-medium text-gray-700 mb-2">
        Context from Previous Steps:
      </div>

      {/* Form Submission */}
      {formSubmission && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => onTogglePrevStep(0)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
            aria-expanded={expandedPrevSteps.has(0)}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-700">Form Submission</span>
              <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                Step 0
              </span>
            </div>
            {expandedPrevSteps.has(0) ? (
              <FiChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <FiChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>
          {expandedPrevSteps.has(0) && (
            <div className="p-3 bg-white border-t border-gray-200">
              <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono overflow-x-auto">
                {typeof formSubmission === 'object'
                  ? Object.entries(formSubmission)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join('\n')
                  : formSubmission}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Previous Workflow Steps */}
      {previousSteps.map((step) => {
        const isExpanded = expandedPrevSteps.has(step.step_order)
        const stepOutput =
          typeof step.output === 'string'
            ? step.output
            : JSON.stringify(step.output, null, 2)

        return (
          <div key={getStepKey(step.step_order)} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => onTogglePrevStep(step.step_order)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
              aria-expanded={isExpanded}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700 truncate">
                  {step.step_name || `Step ${step.step_order}`}
                </span>
                <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded flex-shrink-0">
                  Step {step.step_order}
                </span>
              </div>
              {isExpanded ? (
                <FiChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
              ) : (
                <FiChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
              )}
            </button>
            {isExpanded && (
              <div className="p-3 bg-white border-t border-gray-200">
                <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono overflow-x-auto max-h-64 overflow-y-auto">
                  {stepOutput}
                </pre>
                {step.image_urls && step.image_urls.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-xs font-medium text-gray-700 mb-2">
                      Generated Images:
                    </div>
                    <div className="space-y-1">
                      {step.image_urls.map((url: string, idx: number) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-blue-600 hover:text-blue-800 hover:underline truncate"
                        >
                          {url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
