'use client'

import { useMemo } from 'react'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'
import { MergedStep } from '@/types/job'
import { useImageArtifacts } from '@/hooks/useImageArtifacts'
import { StepHeader } from './StepHeader'
import { StepInputOutput } from './StepInputOutput'
import { StepProgressBar } from './StepProgressBar'
import { ArtifactPreview } from './ArtifactPreview'
import { ImagePreview } from './ImagePreview'
import { getStepStatus, getPreviousSteps, getFormSubmission } from './utils'
import { Artifact } from '@/types/artifact'

interface ExecutionStepsProps {
  steps: MergedStep[]
  expandedSteps: Set<number>
  showExecutionSteps: boolean
  onToggleShow: () => void
  onToggleStep: (stepOrder: number) => void
  onCopy: (text: string) => void
  jobStatus?: string
  onRerunStep?: (stepIndex: number) => Promise<void>
  rerunningStep?: number | null
  onEditStep?: (stepIndex: number) => void
  canEdit?: boolean
  jobId?: string
}

export function ExecutionSteps({
  steps,
  expandedSteps,
  showExecutionSteps,
  onToggleShow,
  onToggleStep,
  onCopy,
  jobStatus,
  onRerunStep,
  rerunningStep,
  onEditStep,
  canEdit = false,
  jobId,
}: ExecutionStepsProps) {
  // Fetch image artifacts using custom hook
  const { imageArtifactsByStep, loading: loadingImageArtifacts } = useImageArtifacts({
    jobId,
    steps,
  })

  // Sort steps by step_order once (must be before early return)
  const sortedSteps = useMemo(() => {
    if (!steps || steps.length === 0) {
      return []
    }
    return [...steps].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0))
  }, [steps])

  // Compute form submission once (must be before early return)
  const formSubmission = useMemo(
    () => getFormSubmission(sortedSteps),
    [sortedSteps]
  )

  // Helper function for step status (not memoized - simple computation)
  const getStepStatusForStep = (step: MergedStep) => {
    return getStepStatus(step, sortedSteps, jobStatus)
  }

  if (!steps || steps.length === 0) {
    return null
  }

  return (
    <div className="mt-4 sm:mt-6 bg-white rounded-lg shadow p-4 sm:p-6">
      <button
        onClick={onToggleShow}
        className="flex items-center justify-between w-full text-left mb-4 touch-target"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Execution Steps</h2>
          <StepProgressBar 
            steps={sortedSteps} 
            jobStatus={jobStatus} 
            getStepStatus={getStepStatusForStep}
          />
        </div>
        {showExecutionSteps ? (
          <FiChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
        ) : (
          <FiChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
        )}
      </button>

      {showExecutionSteps && (
        <div className="space-y-2 pt-4 border-t border-gray-200">
          {sortedSteps.map((step) => {
            const stepOrder = step.step_order ?? 0
            const isExpanded = expandedSteps.has(stepOrder)
            const stepStatus = getStepStatusForStep(step)
            const isPending = stepStatus === 'pending'
            const isInProgress = stepStatus === 'in_progress'

            // Simple className based on status
            const stepClassName = isPending
              ? 'border-gray-200 bg-gray-50'
              : isInProgress
              ? 'border-blue-300 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-gray-300'

            return (
              <div 
                key={stepOrder} 
                className={`border rounded-lg transition-colors ${stepClassName}`}
              >
                <StepHeader
                  step={step}
                  status={stepStatus}
                  jobStatus={jobStatus}
                  canEdit={canEdit}
                  rerunningStep={rerunningStep}
                  onEditStep={onEditStep}
                  onRerunStep={onRerunStep}
                />

                <StepInputOutput
                  step={step}
                  status={stepStatus}
                  isExpanded={isExpanded}
                  onToggle={() => onToggleStep(stepOrder)}
                  onCopy={onCopy}
                  previousSteps={getPreviousSteps(step, sortedSteps)}
                  formSubmission={formSubmission}
                  imageArtifacts={imageArtifactsByStep.get(stepOrder) || []}
                  loadingImageArtifacts={loadingImageArtifacts}
                />

                {/* Show generated files/images in preview with deduplication */}
                {(() => {
                  const stepImageUrls = (step.image_urls && Array.isArray(step.image_urls) && step.image_urls.length > 0) ? step.image_urls : []
                  const stepImageArtifacts = imageArtifactsByStep.get(stepOrder) || []
                  const mainArtifactId = step.artifact_id
                  
                  // Helper to extract filename from URL
                  const getFilenameFromUrl = (url: string): string => {
                    try {
                      const urlObj = new URL(url)
                      const pathname = urlObj.pathname
                      const filename = pathname.split('/').pop() || ''
                      return filename
                    } catch {
                      // If URL parsing fails, try to extract from string
                      const parts = url.split('/')
                      return parts[parts.length - 1] || url
                    }
                  }
                  
                  // Helper to normalize filename for comparison (remove query params, etc.)
                  const normalizeFilename = (filename: string): string => {
                    return filename.split('?')[0].toLowerCase()
                  }
                  
                  // Get main artifact filename if it exists (we'll fetch it if needed)
                  // For now, we'll use a simpler approach: collect all unique files
                  const displayedFiles = new Set<string>()
                  const filesToShow: Array<{ type: 'artifact' | 'imageArtifact' | 'imageUrl', data: any, key: string }> = []
                  
                  // Priority 1: Main artifact (step.artifact_id) - show as ArtifactPreview
                  if (mainArtifactId) {
                    // We'll show this separately below, but track it to avoid duplicates
                    displayedFiles.add(`artifact:${mainArtifactId}`)
                  }
                  
                  // Priority 2: Image artifacts (from imageArtifacts hook)
                  stepImageArtifacts.forEach((artifact: Artifact) => {
                    const artifactId = artifact.artifact_id
                    const fileName = artifact.file_name || artifact.artifact_name || ''
                    const normalizedName = normalizeFilename(fileName)
                    
                    // Skip if this is the main artifact
                    if (artifactId === mainArtifactId) {
                      return
                    }
                    
                    // Skip if we've already seen this filename from another source
                    if (normalizedName && displayedFiles.has(`filename:${normalizedName}`)) {
                      return
                    }
                    
                    displayedFiles.add(`filename:${normalizedName}`)
                    displayedFiles.add(`artifact:${artifactId}`)
                    filesToShow.push({
                      type: 'imageArtifact',
                      data: artifact,
                      key: `image-artifact-${artifactId}`
                    })
                  })
                  
                  // Priority 3: Image URLs (from step.image_urls)
                  stepImageUrls.forEach((imageUrl: string, idx: number) => {
                    const filename = getFilenameFromUrl(imageUrl)
                    const normalizedName = normalizeFilename(filename)
                    
                    // Skip if we've already seen this filename
                    if (normalizedName && displayedFiles.has(`filename:${normalizedName}`)) {
                      return
                    }
                    
                    // Check if this URL matches any artifact we're already showing
                    const matchesExistingArtifact = stepImageArtifacts.some((artifact: Artifact) => {
                      const artifactUrl = artifact.object_url || artifact.public_url
                      return artifactUrl === imageUrl || normalizeFilename(artifact.file_name || artifact.artifact_name || '') === normalizedName
                    })
                    
                    if (matchesExistingArtifact) {
                      return
                    }
                    
                    displayedFiles.add(`filename:${normalizedName}`)
                    filesToShow.push({
                      type: 'imageUrl',
                      data: imageUrl,
                      key: `image-url-${idx}`
                    })
                  })
                  
                  // Render unique files
                  if (filesToShow.length > 0) {
                    return (
                      <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                        {filesToShow.map((file) => {
                          if (file.type === 'imageArtifact') {
                            return (
                              <ImagePreview
                                key={file.key}
                                artifact={file.data}
                                imageIndex={0}
                              />
                            )
                          } else if (file.type === 'imageUrl') {
                            return (
                              <ImagePreview
                                key={file.key}
                                imageUrl={file.data}
                                imageIndex={0}
                              />
                            )
                          }
                          return null
                        })}
                      </div>
                    )
                  }
                  
                  return null
                })()}

                {/* Show main artifact (step output) - highest priority */}
                {step.artifact_id && (
                  <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                    <ArtifactPreview artifactId={step.artifact_id} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
