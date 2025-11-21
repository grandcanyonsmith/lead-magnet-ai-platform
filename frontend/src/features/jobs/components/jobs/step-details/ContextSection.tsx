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

  const entries: { title: string; subtitle: string; body: string; images: string[] }[] = []

  if (hasFormData) {
    entries.push({
      title: 'Form Submission',
      subtitle: 'Step 0',
      body: formText,
      images: formImageUrls,
    })
  }

  previousSteps.forEach((step) => {
    const stepOutput =
      typeof step.output === 'string'
        ? step.output
        : step.output !== null && step.output !== undefined
          ? JSON.stringify(step.output, null, 2)
          : ''
    const stepImageUrls = extractImageUrls(stepOutput)
    entries.push({
      title: step.step_name || `Step ${step.step_order}`,
      subtitle: `Step ${step.step_order}`,
      body: stepOutput,
      images: stepImageUrls,
    })
  })

  return (
    <div className="mb-5 md:mb-4 pb-5 md:pb-4 border-b border-white/60 space-y-2">
      <div className="flex flex-wrap gap-2">
        {entries.map((entry, idx) => (
          <details
            key={`${currentStepOrder}-context-${idx}`}
            className="group rounded-full border border-white/60 bg-white shadow-soft overflow-hidden"
          >
            <summary className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-ink-800 cursor-pointer">
              <span className="truncate max-w-[220px]">
                {entry.title} <span className="text-ink-500 font-normal">({entry.subtitle})</span>
              </span>
              <span className="text-ink-400">↕</span>
            </summary>
            <div className="px-3 pb-3 md:px-3 md:pb-3 space-y-3 bg-white">
              <div className="text-sm md:text-xs text-ink-800 whitespace-pre-wrap font-mono overflow-x-auto bg-surface-50 p-3 md:p-2.5 rounded-2xl border border-white/60 max-h-40 overflow-y-auto scrollbar-hide-until-hover leading-relaxed">
                {renderTextWithImages(entry.body || 'No context')}
              </div>
              {entry.images.length > 0 && (
                <div className="space-y-2 md:space-y-1">
                  {entry.images.map((url, imageIdx) => (
                    <InlineImage key={`context-image-${idx}-${imageIdx}`} url={url} alt={`${entry.title} image ${imageIdx + 1}`} />
                  ))}
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
