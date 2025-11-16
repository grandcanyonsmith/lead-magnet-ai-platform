'use client'

import { WorkflowStep } from '@/features/workflows/types'

interface WebhookConfigProps {
  step: WorkflowStep
  webhookHeaders: Record<string, string>
  allSteps: WorkflowStep[]
  currentStepIndex: number
  onChange: (field: keyof WorkflowStep, value: any) => void
  onWebhookHeadersChange: (headers: Record<string, string>) => void
}

export function WebhookConfig({
  step,
  webhookHeaders,
  allSteps,
  currentStepIndex,
  onChange,
  onWebhookHeadersChange
}: WebhookConfigProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Webhook URL *
        </label>
        <input
          type="url"
          value={step.webhook_url || ''}
          onChange={(e) => onChange('webhook_url', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="https://example.com/webhook"
          required
        />
        <p className="mt-1 text-sm text-gray-500">
          The URL where the POST request will be sent with selected data.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Webhook Headers (optional)
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Add custom headers to include in the webhook request (e.g., Authorization).
        </p>
        <div className="space-y-2">
          {Object.entries(webhookHeaders).map(([key, value], idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                value={key}
                onChange={(e) => {
                  const newHeaders = { ...webhookHeaders }
                  delete newHeaders[key]
                  newHeaders[e.target.value] = value
                  onWebhookHeadersChange(newHeaders)
                  onChange('webhook_headers', newHeaders)
                }}
                placeholder="Header name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => {
                  const newHeaders = { ...webhookHeaders, [key]: e.target.value }
                  onWebhookHeadersChange(newHeaders)
                  onChange('webhook_headers', newHeaders)
                }}
                placeholder="Header value"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const newHeaders = { ...webhookHeaders }
                  delete newHeaders[key]
                  onWebhookHeadersChange(newHeaders)
                  onChange('webhook_headers', newHeaders)
                }}
                className="px-3 py-2 text-red-600 hover:text-red-700 text-sm"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const newHeaders = { ...webhookHeaders, '': '' }
              onWebhookHeadersChange(newHeaders)
            }}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            + Add Header
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Data Selection
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Choose which data to include in the webhook payload. All step outputs are included by default.
        </p>
        
        <div className="space-y-3">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={step.webhook_data_selection?.include_submission !== false}
              onChange={(e) => {
                const dataSelection = step.webhook_data_selection || {
                  include_submission: true,
                  exclude_step_indices: [],
                  include_job_info: true
                }
                onChange('webhook_data_selection', {
                  ...dataSelection,
                  include_submission: e.target.checked
                })
              }}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-900">Include submission data</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={step.webhook_data_selection?.include_job_info !== false}
              onChange={(e) => {
                const dataSelection = step.webhook_data_selection || {
                  include_submission: true,
                  exclude_step_indices: [],
                  include_job_info: true
                }
                onChange('webhook_data_selection', {
                  ...dataSelection,
                  include_job_info: e.target.checked
                })
              }}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-900">Include job information</span>
          </label>

          {allSteps.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Exclude Step Outputs (optional)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                All step outputs are included by default. Check steps to exclude from the payload.
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                {allSteps.map((otherStep, otherIndex) => {
                  if (otherIndex >= currentStepIndex) return null // Can't exclude future steps
                  const isExcluded = (step.webhook_data_selection?.exclude_step_indices || []).includes(otherIndex)
                  return (
                    <label key={otherIndex} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isExcluded}
                        onChange={(e) => {
                          const dataSelection = step.webhook_data_selection || {
                            include_submission: true,
                            exclude_step_indices: [],
                            include_job_info: true
                          }
                          const currentExcluded = dataSelection.exclude_step_indices || []
                          const newExcluded = e.target.checked
                            ? [...currentExcluded, otherIndex]
                            : currentExcluded.filter((idx: number) => idx !== otherIndex)
                          onChange('webhook_data_selection', {
                            ...dataSelection,
                            exclude_step_indices: newExcluded
                          })
                        }}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-900">
                        Exclude: {otherStep.step_name || `Step ${otherIndex + 1}`}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

