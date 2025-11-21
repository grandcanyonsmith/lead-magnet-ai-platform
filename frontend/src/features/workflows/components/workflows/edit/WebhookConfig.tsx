'use client'

import { useState } from 'react'
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
  const [useCustomPayload, setUseCustomPayload] = useState(!!step.webhook_custom_payload)
  const [customPayloadJson, setCustomPayloadJson] = useState(
    step.webhook_custom_payload ? JSON.stringify(step.webhook_custom_payload, null, 2) : ''
  )
  const [payloadError, setPayloadError] = useState<string | null>(null)

  const handleCustomPayloadToggle = (enabled: boolean) => {
    setUseCustomPayload(enabled)
    if (enabled) {
      // Initialize with empty object if no custom payload exists
      if (!step.webhook_custom_payload) {
        setCustomPayloadJson('{\n  \n}')
        onChange('webhook_custom_payload', {})
      }
    } else {
      // Clear custom payload when disabled
      onChange('webhook_custom_payload', undefined)
      setCustomPayloadJson('')
      setPayloadError(null)
    }
  }

  const handleCustomPayloadChange = (value: string) => {
    setCustomPayloadJson(value)
    setPayloadError(null)
    
    try {
      if (value.trim()) {
        const parsed = JSON.parse(value)
        onChange('webhook_custom_payload', parsed)
      } else {
        onChange('webhook_custom_payload', undefined)
      }
    } catch (e) {
      setPayloadError('Invalid JSON format')
      // Don't update the step if JSON is invalid
    }
  }

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Webhook URL *
        </label>
        <input
          type="text"
          value={step.webhook_url || ''}
          onChange={(e) => {
            e.stopPropagation()
            const newValue = e.target.value
            onChange('webhook_url', newValue)
          }}
          onKeyDown={(e) => {
            e.stopPropagation()
            // Prevent form submission on Enter
            if (e.key === 'Enter') {
              e.preventDefault()
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="https://example.com/webhook"
          autoComplete="off"
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
                  e.stopPropagation()
                  const newHeaders = { ...webhookHeaders }
                  delete newHeaders[key]
                  newHeaders[e.target.value] = value
                  onWebhookHeadersChange(newHeaders)
                  onChange('webhook_headers', newHeaders)
                }}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Header name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                autoComplete="off"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => {
                  e.stopPropagation()
                  const newHeaders = { ...webhookHeaders, [key]: e.target.value }
                  onWebhookHeadersChange(newHeaders)
                  onChange('webhook_headers', newHeaders)
                }}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Header value"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                autoComplete="off"
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
        <label className="flex items-center space-x-2 cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={useCustomPayload}
            onChange={(e) => handleCustomPayloadToggle(e.target.checked)}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
          <span className="text-sm font-medium text-gray-700">Use custom payload</span>
        </label>
        <p className="text-xs text-gray-500 mb-3">
          {useCustomPayload 
            ? 'Enter a custom JSON payload to send. This will override the dynamic data selection.'
            : 'Choose which data to include in the webhook payload. All step outputs are included by default.'}
        </p>

        {useCustomPayload && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Custom Payload (JSON) *
            </label>
            <textarea
              value={customPayloadJson}
              onChange={(e) => handleCustomPayloadChange(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 font-mono text-sm ${
                payloadError 
                  ? 'border-red-300 focus:ring-red-500' 
                  : 'border-gray-300 focus:ring-primary-500'
              }`}
              rows={10}
              placeholder='{\n  "key": "value"\n}'
              autoComplete="off"
            />
            {payloadError && (
              <p className="mt-1 text-sm text-red-600">{payloadError}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Enter a valid JSON object that will be sent as the webhook payload.
            </p>
          </div>
        )}
      </div>

      {!useCustomPayload && (
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
      )}
    </>
  )
}

