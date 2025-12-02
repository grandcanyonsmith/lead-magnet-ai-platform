'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useRef, useMemo } from 'react'
import {
  FiChevronDown,
  FiChevronUp,
  FiExternalLink,
  FiRefreshCw,
  FiCopy,
  FiFileText,
  FiClock,
  FiActivity,
  FiImage,
  FiLayers,
} from 'react-icons/fi'
import { useJobDetail } from '@/hooks/useJobDetail'
import { useJobExecutionSteps } from '@/hooks/useJobExecutionSteps'
import { useMergedSteps } from '@/hooks/useMergedSteps'
import { JobHeader } from '@/components/jobs/JobHeader'
import { JobDetails } from '@/components/jobs/JobDetails'
import { ExecutionSteps } from '@/components/jobs/ExecutionSteps'
import { TechnicalDetails } from '@/components/jobs/TechnicalDetails'
import { ResubmitModal } from '@/components/jobs/ResubmitModal'
import FlowchartSidePanel from '@/app/dashboard/workflows/components/FlowchartSidePanel'
import { useImageArtifacts } from '@/hooks/useImageArtifacts'
import { api } from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { WorkflowStep } from '@/types'
import { toast } from 'react-hot-toast'
import { PreviewRenderer } from '@/components/artifacts/PreviewRenderer'
import { Artifact } from '@/types/artifact'
import { formatRelativeTime, formatDuration } from '@/utils/date'
import type { Job } from '@/types/job'
import type { Workflow } from '@/types/workflow'

export default function JobDetailClient() {
  const router = useRouter()
  const [showResubmitModal, setShowResubmitModal] = useState(false)
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null)
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
  const [showRerunConfirm, setShowRerunConfirm] = useState(false)
  const [stepIndexForRerun, setStepIndexForRerun] = useState<number | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showFormSubmission, setShowFormSubmission] = useState(false)
  const latestStepUpdateRef = useRef<WorkflowStep | null>(null)
  const {
    job,
    workflow,
    form,
    submission,
    loading,
    error,
    resubmitting,
    handleResubmit,
    rerunningStep,
    handleRerunStep,
    executionStepsError,
    refreshJob,
    refreshing,
    lastLoadedAt,
  } = useJobDetail()
  
  const {
    showExecutionSteps,
    setShowExecutionSteps,
    expandedSteps,
    toggleStep,
  } = useJobExecutionSteps()

  // Use the extracted merged steps hook
  const mergedSteps = useMergedSteps({ job, workflow })
  const {
    imageArtifactsByStep,
    artifacts: jobArtifacts,
    loading: loadingArtifacts,
  } = useImageArtifacts({
    jobId: job?.job_id,
    steps: mergedSteps,
  })
  const [activeTab, setActiveTab] = useState<TabKey>('execution')
  const artifactGalleryItems = useMemo<ArtifactGalleryItem[]>(() => {
    const items: ArtifactGalleryItem[] = []
    const seen = new Set<string>()
    const stepMetaByArtifactId = new Map<string, StepMeta>()
    const stepsForMeta = mergedSteps ?? []

    stepsForMeta.forEach((step) => {
      if (step.artifact_id) {
        stepMetaByArtifactId.set(step.artifact_id, {
          stepOrder: step.step_order ?? undefined,
          stepName: step.step_name,
          stepType: step.step_type,
        })
      }
    })

    jobArtifacts?.forEach((artifact, index) => {
      const uniqueKey =
        artifact.artifact_id ||
        artifact.object_url ||
        artifact.public_url ||
        `${artifact.file_name || artifact.artifact_name || 'artifact'}-${index}`

      if (!uniqueKey || seen.has(uniqueKey)) {
        return
      }

      seen.add(uniqueKey)

      const meta = artifact.artifact_id ? stepMetaByArtifactId.get(artifact.artifact_id) : undefined
      const typeString =
        artifact.artifact_type?.toLowerCase() || artifact.content_type?.toLowerCase() || ''
      const isImage = typeString.includes('image')
      const label =
        meta?.stepOrder !== undefined || meta?.stepName
          ? formatStepLabel(meta?.stepOrder, meta?.stepType, meta?.stepName)
          : artifact.artifact_name || artifact.file_name || 'Generated Artifact'

      const urlKey = artifact.object_url || artifact.public_url
      if (urlKey) {
        seen.add(urlKey)
      }

      items.push({
        id: uniqueKey,
        kind: isImage ? 'imageArtifact' : 'artifact',
        artifact,
        stepOrder: meta?.stepOrder,
        stepName: meta?.stepName,
        stepType: meta?.stepType,
        label,
        description: artifact.artifact_type?.replace(/_/g, ' ') || artifact.file_name || artifact.artifact_name,
      })
    })

    stepsForMeta.forEach((step) => {
      if (!step.image_urls || step.image_urls.length === 0) {
        return
      }
      const label = formatStepLabel(step.step_order ?? undefined, step.step_type, step.step_name)
      step.image_urls.forEach((url, idx) => {
        if (!url || seen.has(url)) {
          return
        }
        seen.add(url)
        items.push({
          id: `image-url-${step.step_order ?? 0}-${idx}`,
          kind: 'imageUrl',
          url,
          stepOrder: step.step_order ?? undefined,
          stepName: step.step_name,
          stepType: step.step_type,
          label,
          description: 'Generated image URL',
        })
      })
    })

    if (job?.output_url && !seen.has(job.output_url)) {
      items.unshift({
        id: 'job-output-url',
        kind: 'jobOutput',
        url: job.output_url,
        label: 'Final Deliverable',
        description: 'Download the generated lead magnet document.',
      })
      seen.add(job.output_url)
    }

    return items
  }, [job?.output_url, jobArtifacts, mergedSteps])

  const stepsSummary = useMemo<StepsSummary>(() => {
    if (!mergedSteps || mergedSteps.length === 0) {
      return { total: 0, completed: 0, failed: 0, running: 0, pending: 0 }
    }
    return mergedSteps.reduce(
      (acc, step) => {
        acc.total += 1
        switch (step._status) {
          case 'completed':
            acc.completed += 1
            break
          case 'failed':
            acc.failed += 1
            break
          case 'in_progress':
            acc.running += 1
            break
          default:
            acc.pending += 1
            break
        }
        return acc
      },
      { total: 0, completed: 0, failed: 0, running: 0, pending: 0 }
    )
  }, [mergedSteps])

  const jobDuration = useMemo(() => getJobDuration(job), [job?.started_at, job?.completed_at, job?.failed_at, job?.status])
  const lastUpdatedLabel = useMemo(() => (job?.updated_at ? formatRelativeTime(job.updated_at) : null), [job?.updated_at])
  const lastRefreshedLabel = useMemo(
    () => (lastLoadedAt ? formatRelativeTime(lastLoadedAt.toISOString()) : null),
    [lastLoadedAt]
  )

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const handleResubmitClick = () => {
    setShowResubmitModal(true)
  }

  const handleResubmitConfirm = async () => {
    await handleResubmit()
    setShowResubmitModal(false)
  }

  const handleEditStep = (stepIndex: number) => {
    setEditingStepIndex(stepIndex)
    setIsSidePanelOpen(true)
    // Reset the ref when opening
    latestStepUpdateRef.current = null
  }

  const handleSaveStep = async (updatedStep: WorkflowStep) => {
    if (!workflow || editingStepIndex === null || !workflow.steps) {
      toast.error('Unable to save: Workflow data not available')
      return
    }

    try {
      // Clone the steps array and merge updated step with original to preserve all fields
      const updatedSteps = [...workflow.steps]
      const originalStep = updatedSteps[editingStepIndex]
      
      // Merge: keep all original fields, override with updated form fields
      updatedSteps[editingStepIndex] = {
        ...originalStep,
        ...updatedStep,
      }

      // Update the workflow via API
      await api.updateWorkflow(workflow.workflow_id, {
        steps: updatedSteps,
      })

      // Show success toast
      toast.success('Step updated successfully')

      // Store the step index for rerun confirmation
      setStepIndexForRerun(editingStepIndex)

      // Close the side panel
      setEditingStepIndex(null)
      setIsSidePanelOpen(false)

      // Show confirmation dialog for rerun
      setShowRerunConfirm(true)

      // Refresh the page to show updated data
      router.refresh()
    } catch (error: any) {
      console.error('Failed to save step:', error)
      toast.error(error.message || 'Failed to save step changes')
      throw error
    }
  }

  const handleCancelEdit = async () => {
    // FlowchartSidePanel's handleClose calls onChange with latest step, then onClose
    // So latestStepUpdateRef should have the latest changes
    // Only save if there are actual changes (ref is set)
    if (latestStepUpdateRef.current && editingStepIndex !== null) {
      const currentStep = workflow?.steps?.[editingStepIndex]
      // Check if there are actual changes by comparing step data
      const hasChanges = currentStep && JSON.stringify(currentStep) !== JSON.stringify(latestStepUpdateRef.current)
      if (hasChanges) {
        await handleSaveStep(latestStepUpdateRef.current)
      }
      latestStepUpdateRef.current = null
    }
    setEditingStepIndex(null)
    setIsSidePanelOpen(false)
  }

  const handleConfirmRerun = async () => {
    if (stepIndexForRerun !== null && handleRerunStep) {
      setShowRerunConfirm(false)
      await handleRerunStep(stepIndexForRerun)
      setStepIndexForRerun(null)
    }
  }

  const handleCancelRerun = () => {
    setShowRerunConfirm(false)
    setStepIndexForRerun(null)
  }


  if (loading) {
    return (
      <div>
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="h-10 bg-gray-200 rounded w-20 mb-4 animate-pulse"></div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0">
            <div>
              <div className="h-7 sm:h-8 bg-gray-200 rounded w-64 mb-2 animate-pulse"></div>
              <div className="h-4 sm:h-5 bg-gray-200 rounded w-96 max-w-full animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Job Details skeleton */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-gray-50 rounded-lg border border-gray-100 p-3">
                  <div className="h-3 bg-gray-200 rounded w-24 mb-2 animate-pulse"></div>
                  <div className="h-5 bg-gray-200 rounded w-32 animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Execution Steps skeleton */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="h-6 bg-gray-200 rounded w-40 mb-4 animate-pulse"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 bg-gray-200 rounded-full animate-pulse flex-shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-gray-200 rounded w-48 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                    <div className="h-20 bg-gray-100 rounded animate-pulse mt-2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error && !job) {
    return (
      <div>
        <JobHeader error={error} resubmitting={false} onResubmit={() => {}} />
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      </div>
    )
  }

  if (!job) {
    return null
  }

  return (
    <div>
      <JobHeader error={error} resubmitting={resubmitting} onResubmit={handleResubmitClick} job={job} />
      
      <JobOverview
        job={job}
        workflow={workflow}
        stepsSummary={stepsSummary}
        artifactCount={artifactGalleryItems.length}
        jobDuration={jobDuration}
        lastUpdatedLabel={lastUpdatedLabel}
        lastRefreshedLabel={lastRefreshedLabel}
        onRefresh={refreshJob}
        refreshing={refreshing}
        onSelectArtifacts={() => setActiveTab('artifacts')}
      />
      
      <ResubmitModal
        isOpen={showResubmitModal}
        onClose={() => setShowResubmitModal(false)}
        onConfirm={handleResubmitConfirm}
        isResubmitting={resubmitting}
      />

      {/* Step Edit Side Panel */}
      {editingStepIndex !== null && workflow?.steps?.[editingStepIndex] && (
        <FlowchartSidePanel
          step={workflow.steps[editingStepIndex]}
          index={editingStepIndex}
          totalSteps={workflow.steps.length}
          allSteps={workflow.steps}
          isOpen={isSidePanelOpen}
          onClose={handleCancelEdit}
          onChange={(index, updatedStep) => {
            // Store the latest step update in a ref
            // When onClose is called, it will have the latest changes
            latestStepUpdateRef.current = updatedStep
          }}
          onDelete={() => {
            // Disable delete in execution viewer context
            toast.error('Cannot delete steps from execution viewer. Please edit the workflow template.')
          }}
          onMoveUp={() => {
            // Disable move in execution viewer context
            toast.error('Cannot reorder steps from execution viewer. Please edit the workflow template.')
          }}
          onMoveDown={() => {
            // Disable move in execution viewer context
            toast.error('Cannot reorder steps from execution viewer. Please edit the workflow template.')
          }}
          workflowId={workflow.workflow_id}
        />
      )}

      {/* Rerun Confirmation Dialog */}
      {showRerunConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={handleCancelRerun}
            />

            {/* Modal */}
            <div className="relative z-50 w-full max-w-md bg-white rounded-lg shadow-xl mx-4">
              <div className="p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
                  Step Updated Successfully
                </h3>
                <p className="text-sm text-gray-600 mb-4 sm:mb-6">
                  Would you like to rerun this step with the updated configuration?
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
                  <button
                    onClick={handleCancelRerun}
                    className="px-4 py-2.5 sm:py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors touch-target min-h-[44px] sm:min-h-0"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmRerun}
                    className="px-4 py-2.5 sm:py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors touch-target min-h-[44px] sm:min-h-0"
                  >
                    Rerun Step
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Execution / Artifact / JSON Tabs */}
      {(() => {
        const hasExecutionData = mergedSteps && mergedSteps.length > 0
        const hasArtifactData = artifactGalleryItems.length > 0
        const hasRawJson =
          (job.execution_steps && job.execution_steps.length > 0) || hasExecutionData
        const shouldShowTabs = hasExecutionData || hasArtifactData || hasRawJson
        const tabOptions: { id: TabKey; label: string }[] = [
          { id: 'execution', label: 'Execution Steps' },
          {
            id: 'artifacts',
            label: `Artifacts${artifactGalleryItems.length ? ` (${artifactGalleryItems.length})` : ''}`,
          },
          { id: 'raw', label: 'Raw JSON' },
        ]

        if (!shouldShowTabs) {
          return executionStepsError ? (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium">Execution Steps Not Available</h3>
                  <p className="mt-1 text-sm">{executionStepsError}</p>
                  {process.env.NODE_ENV === 'development' && job?.execution_steps_s3_key && (
                    <p className="mt-2 text-xs font-mono break-all">
                      S3 Key: {job.execution_steps_s3_key}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null
        }

        return (
          <div className="mt-4 sm:mt-6 bg-white rounded-lg shadow">
            <div
              role="tablist"
              aria-label="Job execution detail tabs"
              className="flex flex-wrap border-b border-gray-200"
            >
              {tabOptions.map((tab) => (
                <button
                  key={tab.id}
                  id={`job-tab-${tab.id}`}
                  role="tab"
                  type="button"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`job-tab-panel-${tab.id}`}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    activeTab === tab.id
                      ? 'border-primary-600 text-primary-700 bg-primary-50/70'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="p-4 sm:p-6 space-y-6">
              <section
                id="job-tab-panel-execution"
                role="tabpanel"
                aria-labelledby="job-tab-execution"
                hidden={activeTab !== 'execution'}
              >
                {activeTab === 'execution' && (
                  <>
                    {executionStepsError && (
                      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-4">
                        <div className="flex items-start">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                              <path
                                fillRule="evenodd"
                                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                          <div className="ml-3 flex-1">
                            <h3 className="text-sm font-medium">Execution Steps Loading Error</h3>
                            <p className="mt-1 text-sm">{executionStepsError}</p>
                            {job?.execution_steps_s3_key && !executionStepsError?.includes('S3 Key:') && (
                              <p className="mt-2 text-xs font-mono break-all">
                                S3 Key: {job.execution_steps_s3_key}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {hasExecutionData ? (
                      <ExecutionSteps
                        steps={mergedSteps}
                        expandedSteps={expandedSteps}
                        showExecutionSteps={showExecutionSteps}
                        onToggleShow={() => setShowExecutionSteps(!showExecutionSteps)}
                        onToggleStep={toggleStep}
                        onCopy={copyToClipboard}
                        jobStatus={job.status}
                        onRerunStep={handleRerunStep}
                        rerunningStep={rerunningStep}
                        onEditStep={handleEditStep}
                        canEdit={!!workflow}
                        imageArtifactsByStep={imageArtifactsByStep}
                        loadingImageArtifacts={loadingArtifacts}
                      />
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-4 text-sm text-gray-600">
                        Execution data is not available for this run yet.
                      </div>
                    )}
                  </>
                )}
              </section>

              <section
                id="job-tab-panel-artifacts"
                role="tabpanel"
                aria-labelledby="job-tab-artifacts"
                hidden={activeTab !== 'artifacts'}
              >
                {activeTab === 'artifacts' && (
                  <ArtifactsPanel items={artifactGalleryItems} loading={loadingArtifacts} />
                )}
              </section>

              <section
                id="job-tab-panel-raw"
                role="tabpanel"
                aria-labelledby="job-tab-raw"
                hidden={activeTab !== 'raw'}
              >
                {activeTab === 'raw' && (
                  <RawJsonPanel data={job.execution_steps?.length ? job.execution_steps : mergedSteps} />
                )}
              </section>
            </div>
          </div>
        )
      })()}

      {/* Details and Form Submission - Collapsible sections at bottom */}
      <div className="mt-4 sm:mt-6 space-y-3 sm:space-y-4">
        {/* Job Details Section */}
        <div className="bg-white rounded-lg shadow">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center justify-between w-full text-left p-4 sm:p-6 touch-target min-h-[48px] sm:min-h-0"
          >
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Details</h2>
            {showDetails ? (
              <FiChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
            ) : (
              <FiChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
            )}
          </button>
          {showDetails && (
            <div className="px-4 sm:px-6 pb-4 sm:pb-6 border-t border-gray-200">
              <div className="pt-4 sm:pt-6">
                <JobDetails job={job} workflow={workflow} hideContainer={true} />
              </div>
            </div>
          )}
        </div>

        {/* Form Submission Details Section */}
        {submission && (
          <div className="bg-white rounded-lg shadow">
            <div className="flex items-center justify-between p-4 sm:p-6">
              <button
                onClick={() => setShowFormSubmission(!showFormSubmission)}
                className="flex items-center justify-between flex-1 text-left touch-target min-h-[48px] sm:min-h-0"
              >
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Form Submission Details</h2>
                {showFormSubmission ? (
                  <FiChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
                ) : (
                  <FiChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleResubmitClick()
                }}
                disabled={resubmitting}
                className="ml-4 flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target min-h-[44px] sm:min-h-0"
                title="Resubmit with same form answers"
              >
                <FiRefreshCw className={`w-4 h-4 ${resubmitting ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Resubmit</span>
              </button>
            </div>
            {showFormSubmission && (
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 border-t border-gray-200">
                <div className="pt-4 sm:pt-6">
                  {submission.form_data ? (
                    <div className="space-y-3">
                      {Object.entries(submission.form_data).map(([key, value]: [string, unknown]) => (
                        <div key={key} className="border-b border-gray-100 pb-3 last:border-b-0">
                          <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                            {key.replace(/_/g, ' ')}
                          </label>
                          <p className="text-sm text-gray-900 break-words">
                            {typeof value === 'string' ? value : JSON.stringify(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No submission data available</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Technical Details */}
        <TechnicalDetails job={job} form={form} submission={submission} />
      </div>
    </div>
  )
}

interface JobOverviewProps {
  job: Job
  workflow?: Workflow | null
  stepsSummary: StepsSummary
  artifactCount: number
  jobDuration?: JobDurationInfo | null
  lastUpdatedLabel?: string | null
  lastRefreshedLabel?: string | null
  onRefresh?: () => void | Promise<void>
  refreshing?: boolean
  onSelectArtifacts?: () => void
}

interface StepsSummary {
  total: number
  completed: number
  failed: number
  running: number
  pending: number
}

interface JobDurationInfo {
  seconds: number
  label: string
  isLive: boolean
}

function JobOverview({
  job,
  workflow,
  stepsSummary,
  artifactCount,
  jobDuration,
  lastUpdatedLabel,
  lastRefreshedLabel,
  onRefresh,
  refreshing,
  onSelectArtifacts,
}: JobOverviewProps) {
  const progressPercent = stepsSummary.total ? Math.round((stepsSummary.completed / stepsSummary.total) * 100) : 0
  const stepStatusCopy = (() => {
    if (stepsSummary.failed > 0) return `${stepsSummary.failed} failed`
    if (stepsSummary.running > 0) return `${stepsSummary.running} running`
    if (stepsSummary.pending > 0) return `${stepsSummary.pending} queued`
    if (stepsSummary.total === 0) return 'No workflow steps'
    return 'All steps completed'
  })()

  const updatedDisplay = lastUpdatedLabel ?? (job.created_at ? formatRelativeTime(job.created_at) : null)
  const startLabel = job.started_at ? formatRelativeTime(job.started_at) : null
  const completedLabel = job.completed_at ? formatRelativeTime(job.completed_at) : null
  const isAutoUpdating = job.status === 'processing'

  const handleCopyJobId = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(job.job_id)
        toast.success('Job ID copied')
      } else {
        throw new Error('Clipboard API not available')
      }
    } catch {
      toast.error('Unable to copy job ID')
    }
  }

  const handleRefresh = () => {
    onRefresh?.()
  }

  const handleViewArtifacts = () => {
    if (artifactCount === 0) {
      return
    }
    onSelectArtifacts?.()
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        document.getElementById('job-tab-panel-artifacts')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }

  return (
    <section className="mb-4 sm:mb-6">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap text-xs font-medium uppercase tracking-wide text-gray-600">
              <StatusBadge status={job.status} />
              {isAutoUpdating && (
                <span className="rounded-full bg-primary-50 px-2 py-0.5 text-primary-700">Live updating</span>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Job ID</p>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="text-2xl font-semibold text-gray-900 break-all">{job.job_id}</span>
                <button
                  type="button"
                  onClick={handleCopyJobId}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <FiCopy className="h-3.5 w-3.5" />
                  Copy ID
                </button>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {updatedDisplay ? (
                <span>Updated {updatedDisplay}</span>
              ) : (
                <span>Waiting for first update</span>
              )}
              {lastRefreshedLabel && (
                <>
                  <span className="mx-2 text-gray-300">•</span>
                  <span>Viewed {lastRefreshedLabel}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-primary-600' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh data'}
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step Progress</p>
                <p className="text-lg font-semibold text-gray-900">
                  {stepsSummary.completed}/{stepsSummary.total || '--'}
                </p>
                <p className="text-sm text-gray-600">{stepStatusCopy}</p>
              </div>
              <span className="inline-flex rounded-full bg-blue-100 p-3 text-blue-700">
                <FiActivity className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-white">
              <span
                className="block h-full rounded-full bg-primary-500 transition-all"
                style={{ width: `${progressPercent}%` }}
                aria-label={`Step progress ${progressPercent}%`}
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Runtime</p>
                <p className="text-lg font-semibold text-gray-900">
                  {jobDuration?.label || (job.started_at ? 'Initializing...' : 'Not started')}
                </p>
                <p className="text-sm text-gray-600">
                  {completedLabel
                    ? `Completed ${completedLabel}`
                    : startLabel
                      ? `Started ${startLabel}`
                      : 'Waiting for worker'}
                </p>
              </div>
              <span className="inline-flex rounded-full bg-orange-100 p-3 text-orange-700">
                <FiClock className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            {jobDuration?.isLive && (
              <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Artifacts</p>
                <p className="text-lg font-semibold text-gray-900">{artifactCount}</p>
                <p className="text-sm text-gray-600">
                  {artifactCount ? 'Artifacts ready to review' : 'Generated assets will appear here'}
                </p>
              </div>
              <span className="inline-flex rounded-full bg-purple-100 p-3 text-purple-700">
                <FiImage className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <button
              type="button"
              onClick={handleViewArtifacts}
              disabled={artifactCount === 0}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiExternalLink className="h-4 w-4" aria-hidden="true" />
              Open gallery
            </button>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Workflow</p>
                <p className="text-lg font-semibold text-gray-900">
                  {workflow?.workflow_name || 'Workflow template'}
                </p>
                <p className="text-sm text-gray-600">
                  {workflow?.steps?.length ? `${workflow.steps.length} configured steps` : 'Workflow metadata unavailable'}
                </p>
              </div>
              <span className="inline-flex rounded-full bg-indigo-100 p-3 text-indigo-700">
                <FiLayers className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            {workflow?.workflow_id ? (
              <Link
                href={`/dashboard/workflows/${workflow.workflow_id}`}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                <FiExternalLink className="h-4 w-4" aria-hidden="true" />
                View template
              </Link>
            ) : (
              <p className="mt-3 text-sm text-gray-500">Workflow details not available for this job</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function getJobDuration(job?: Job | null): JobDurationInfo | null {
  if (!job?.started_at) {
    return null
  }

  const start = new Date(job.started_at).getTime()
  const endTimestamp = job.completed_at || job.failed_at ? new Date(job.completed_at || job.failed_at || '').getTime() : Date.now()
  const seconds = Math.max(0, Math.round((endTimestamp - start) / 1000))

  return {
    seconds,
    label: formatDuration(seconds),
    isLive: !job.completed_at && !job.failed_at && job.status === 'processing',
  }
}

type TabKey = 'execution' | 'artifacts' | 'raw'

interface StepMeta {
  stepOrder?: number
  stepName?: string
  stepType?: string
}

interface ArtifactGalleryItem {
  id: string
  kind: 'jobOutput' | 'artifact' | 'imageArtifact' | 'imageUrl'
  artifact?: Artifact
  url?: string
  stepOrder?: number
  stepName?: string
  stepType?: string
  label: string
  description?: string
}

interface ArtifactsPanelProps {
  items: ArtifactGalleryItem[]
  loading: boolean
}

function ArtifactsPanel({ items, loading }: ArtifactsPanelProps) {
  if (loading && items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/80 p-4 text-sm text-gray-600">
        Loading artifacts&mldr;
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/80 p-4 text-sm text-gray-600">
        No artifacts have been generated for this run yet.
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <ArtifactCard key={item.id} item={item} />
      ))}
    </div>
  )
}

interface ArtifactCardProps {
  item: ArtifactGalleryItem
}

const BADGE_CLASS_MAP: Record<ArtifactGalleryItem['kind'], string> = {
  artifact: 'bg-blue-100 text-blue-800 border border-blue-200',
  imageArtifact: 'bg-purple-100 text-purple-800 border border-purple-200',
  imageUrl: 'bg-teal-100 text-teal-800 border border-teal-200',
  jobOutput: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
}

function ArtifactCard({ item }: ArtifactCardProps) {
  const artifactUrl = item.artifact?.object_url || item.artifact?.public_url || item.url
  const fileName =
    item.artifact?.file_name ||
    item.artifact?.artifact_name ||
    item.url ||
    item.label ||
    'Artifact'

  const badgeLabel = (() => {
    switch (item.kind) {
      case 'jobOutput':
        return 'Final Output'
      case 'imageArtifact':
        return 'Image Artifact'
      case 'imageUrl':
        return 'Image URL'
      default:
        return 'Artifact'
    }
  })()

  const handleCopy = async (value: string, successMessage: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(value)
      } else {
        throw new Error('Clipboard API not available')
      }
      toast.success(successMessage)
    } catch {
      toast.error('Unable to copy to clipboard')
    }
  }

  return (
    <article className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {item.stepOrder !== undefined && (
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Step {item.stepOrder}
            </p>
          )}
          <p className="text-base font-semibold text-gray-900 mt-0.5 break-words">{item.label}</p>
          {item.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.description}</p>
          )}
        </div>
        <span
          className={`px-2.5 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${BADGE_CLASS_MAP[item.kind]}`}
        >
          {badgeLabel}
        </span>
      </div>

      {artifactUrl && item.kind !== 'jobOutput' && (
        <div className="border-t border-gray-100">
          <div className="aspect-video bg-gray-50 relative overflow-hidden">
            <PreviewRenderer
              contentType={item.artifact?.content_type || (item.kind === 'imageUrl' ? 'image/png' : undefined)}
              objectUrl={artifactUrl}
              fileName={fileName}
              className="w-full h-full"
              artifactId={item.artifact?.artifact_id}
            />
          </div>
        </div>
      )}

      {item.kind === 'jobOutput' && (
        <div className="px-4 pb-2 text-sm text-gray-600">
          Access the final deliverable generated for this run.
        </div>
      )}

      <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-gray-100">
        {artifactUrl && (
          <a
            href={artifactUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
          >
            <FiExternalLink className="h-4 w-4" aria-hidden="true" />
            View
          </a>
        )}
        {item.kind === 'jobOutput' && item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <FiFileText className="h-4 w-4" aria-hidden="true" />
            Download
          </a>
        )}
        {item.artifact?.artifact_id && (
          <button
            type="button"
            onClick={() => handleCopy(item.artifact!.artifact_id!, 'Artifact ID copied')}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <FiCopy className="h-4 w-4" aria-hidden="true" />
            Copy ID
          </button>
        )}
        {!item.artifact?.artifact_id && artifactUrl && (
          <button
            type="button"
            onClick={() => handleCopy(artifactUrl, 'Link copied')}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <FiCopy className="h-4 w-4" aria-hidden="true" />
            Copy link
          </button>
        )}
      </div>
    </article>
  )
}

function RawJsonPanel({ data }: { data: unknown }) {
  const hasData = Array.isArray(data) ? data.length > 0 : Boolean(data)

  if (!hasData) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/80 p-4 text-sm text-gray-600">
        No raw JSON data is available for this run.
      </div>
    )
  }

  const jsonString = JSON.stringify(data, null, 2)

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(jsonString)
        toast.success('Execution JSON copied')
      } else {
        throw new Error('Clipboard API not available')
      }
    } catch {
      toast.error('Unable to copy JSON')
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-950 text-gray-100">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <p className="text-sm font-semibold">Raw execution JSON</p>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-gray-800"
        >
          <FiCopy className="h-4 w-4" aria-hidden="true" />
          Copy JSON
        </button>
      </div>
      <pre className="overflow-auto text-xs leading-relaxed p-4 text-gray-100">
        {jsonString}
      </pre>
    </div>
  )
}

function formatStepLabel(stepOrder?: number, stepType?: string, stepName?: string) {
  const typeLabel = stepType ? formatStepType(stepType) : ''
  if (stepName) {
    const orderLabel = stepOrder !== undefined ? `${stepOrder}. ` : ''
    return `${orderLabel}${stepName}`
  }
  if (typeLabel) {
    return stepOrder !== undefined ? `${stepOrder}. ${typeLabel}` : typeLabel
  }
  return stepOrder !== undefined ? `Step ${stepOrder}` : 'Workflow Step'
}

function formatStepType(stepType?: string) {
  if (!stepType) {
    return ''
  }
  return stepType.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

