'use client'

import React from 'react'
import { InlineImage } from '../InlineImage'
import { extractImageUrls } from '@/shared/utils/imageUtils'
import { ExecutionStep } from '@/features/jobs/types'

function renderTextWithImages(text: string): React.ReactNode {
  const imageUrls = extractImageUrls(text)

  if (imageUrls.length === 0) {
    return <>{text}</>
  }

  let remainingText = text
  const parts: React.ReactNode[] = []
  let partIndex = 0

  imageUrls.forEach((url, idx) => {
    const urlIndex = remainingText.indexOf(url)
    if (urlIndex === -1) return

    if (urlIndex > 0) {
      parts.push(
        <span key={`text-${partIndex++}`}>
          {remainingText.substring(0, urlIndex)}
        </span>
      )
    }

    parts.push(
      <div key={`image-${idx}`} className="block my-2">
        <InlineImage url={url} alt={`Image ${idx + 1}`} />
      </div>
    )

    remainingText = remainingText.substring(urlIndex + url.length)
  })

  if (remainingText.length > 0) {
    parts.push(
      <span key={`text-${partIndex}`}>
        {remainingText}
      </span>
    )
  }

  return <>{parts}</>
}

function stringifyFormSubmission(
  formSubmission: Record<string, unknown> | null | undefined
): string {
  if (!formSubmission) {
    return ''
  }

  if (typeof formSubmission === 'object') {
    return Object.entries(formSubmission)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')
  }

  return String(formSubmission)
}

interface ContextSectionProps {
  previousSteps: ExecutionStep[]
  formSubmission: Record<string, unknown> | null | undefined
  currentStepOrder: number
}

export function ContextSection({
  previousSteps,
  formSubmission,
  currentStepOrder,
}: ContextSectionProps) {
  const hasPreviousSteps = previousSteps && previousSteps.length > 0
  const hasFormData = Boolean(formSubmission)

  if (!hasPreviousSteps && !hasFormData) {
    return null
  }

  const formText = stringifyFormSubmission(formSubmission)
  const formImageUrls = formText ? extractImageUrls(formText) : []

  return (
    <div className="mb-5 md:mb-4 pb-5 md:pb-4 border-b border-gray-200">
      <div className="text-sm md:text-xs font-medium text-gray-700 mb-3 md:mb-2">
        Context from Previous Steps:
      </div>

      {hasFormData && (
        <div className="mb-2">
          <div className="text-sm md:text-xs font-medium text-gray-600 mb-2 md:mb-1">
            Form Submission <span className="text-gray-500">(Step 0)</span>
          </div>
          <div className="text-sm md:text-xs text-gray-700 whitespace-pre-wrap font-mono overflow-x-auto bg-gray-50 p-3 md:p-2.5 rounded-lg border border-gray-200 max-h-32 overflow-y-auto scrollbar-hide-until-hover leading-relaxed">
            {renderTextWithImages(formText)}
          </div>
          {formImageUrls.length > 0 && (
            <div className="mt-4 space-y-4 md:space-y-2">
              {formImageUrls.map((url, idx) => (
                <InlineImage key={`form-image-${idx}`} url={url} alt={`Form submission image ${idx + 1}`} />
              ))}
            </div>
          )}
        </div>
      )}

      {previousSteps.map((step, index) => {
        const stepOutput =
          typeof step.output === 'string'
            ? step.output
            : step.output !== null && step.output !== undefined
              ? JSON.stringify(step.output, null, 2)
              : ''
        const stepImageUrls = extractImageUrls(stepOutput)

        return (
          <div key={`${currentStepOrder}-prev-${step.step_order}-${index}`} className="mb-2 last:mb-0">
            <div className="text-sm md:text-xs font-medium text-gray-600 mb-2 md:mb-1">
              {step.step_name || `Step ${step.step_order}`}{' '}
              <span className="text-gray-500">(Step {step.step_order})</span>
            </div>
            <div className="text-sm md:text-xs text-gray-700 whitespace-pre-wrap font-mono overflow-x-auto bg-gray-50 p-3 md:p-2.5 rounded-lg border border-gray-200 max-h-32 overflow-y-auto scrollbar-hide-until-hover leading-relaxed">
              {renderTextWithImages(stepOutput)}
            </div>
            {stepImageUrls.length > 0 && (
              <div className="mt-4 md:mt-2 space-y-4 md:space-y-2">
                {stepImageUrls.map((url, idx) => (
                  <InlineImage key={`step-output-image-${idx}`} url={url} alt={`Step ${step.step_order} output image ${idx + 1}`} />
                ))}
              </div>
            )}
            {step.image_urls && step.image_urls.length > 0 && (
              <div className="mt-4 md:mt-2">
                <div className="text-sm md:text-xs font-medium text-gray-600 mb-3 md:mb-1">
                  Generated Images:
                </div>
                <div className="space-y-4 md:space-y-2">
                  {step.image_urls.map((url: string, idx: number) => (
                    <InlineImage key={`step-image-url-${idx}`} url={url} alt={`Generated image ${idx + 1}`} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

