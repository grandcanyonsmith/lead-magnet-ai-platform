'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useRef, useMemo } from 'react'
import { FiChevronDown, FiChevronUp, FiCopy } from 'react-icons/fi'
import { useJobDetail } from '@/hooks/useJobDetail'
import { useJobExecutionSteps } from '@/hooks/useJobExecutionSteps'
import { useMergedSteps } from '@/hooks/useMergedSteps'
import { JobHeader } from '@/components/jobs/JobHeader'
import { JobDetails } from '@/components/jobs/JobDetails'
import { ExecutionSteps } from '@/components/jobs/ExecutionSteps'
import { TechnicalDetails } from '@/components/jobs/TechnicalDetails'
import { ResubmitModal } from '@/components/jobs/ResubmitModal'
import { RerunStepDialog } from '@/components/jobs/RerunStepDialog'
import FlowchartSidePanel from '@/app/dashboard/workflows/components/FlowchartSidePanel'
import { useImageArtifacts } from '@/hooks/useImageArtifacts'
import { api } from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { WorkflowStep } from '@/types'
import { toast } from 'react-hot-toast'
import { Artifact } from '@/types/artifact'
import { formatRelativeTime, formatDuration } from '@/utils/date'
import { buildArtifactGalleryItems } from '@/utils/jobs/artifacts'
import { summarizeStepProgress } from '@/utils/jobs/steps'
import type { ArtifactGalleryItem, Job, JobStepSummary } from '@/types/job'
import type { Workflow } from '@/types/workflow'
import { FullScreenPreviewModal } from '@/components/ui/FullScreenPreviewModal'
import { JobOverviewSection, JobDurationInfo } from '@/components/jobs/detail/JobOverviewSection'
import { SubmissionSummary } from '@/components/jobs/detail/SubmissionSummary'
import { ArtifactGallery } from '@/components/jobs/detail/ArtifactGallery'
import { usePreviewModal } from '@/hooks/usePreviewModal'

export default function JobDetailClient() {
  const router = useRouter()
  const [showResubmitModal, setShowResubmitModal] = useState(false)
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null)
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
  const [showRerunDialog, setShowRerunDialog] = useState(false)
  const [stepIndexForRerun, setStepIndexForRerun] = useState<number | null>(null)
  const [showDetails, setShowDetails] = useState(true)
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
  const { previewItem, openPreview, closePreview } = usePreviewModal<ArtifactGalleryItem>()
  const artifactGalleryItems = useMemo<ArtifactGalleryItem[]>(
    () => buildArtifactGalleryItems({ job, artifacts: jobArtifacts, steps: mergedSteps }),
    [job, jobArtifacts, mergedSteps]
  )

  const stepsSummary = useMemo<JobStepSummary>(() => summarizeStepProgress(mergedSteps), [mergedSteps])

  const jobDuration = useMemo(() => getJobDuration(job), [job])
  const lastUpdatedLabel = useMemo(() => (job?.updated_at ? formatRelativeTime(job.updated_at) : null), [job?.updated_at])
  const lastRefreshedLabel = useMemo(
    () => (lastLoadedAt ? formatRelativeTime(lastLoadedAt.toISOString()) : null),
    [lastLoadedAt]
  )
  const previewObjectUrl =
    previewItem?.artifact?.object_url || previewItem?.artifact?.public_url || previewItem?.url
  const previewContentType =
    previewItem?.artifact?.content_type || (previewItem?.kind === 'imageUrl' ? 'image/png' : undefined)
  const previewFileName =
    previewItem?.artifact?.file_name || previewItem?.artifact?.artifact_name || previewItem?.label

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

      // Store the step index for rerun dialog
      setStepIndexForRerun(editingStepIndex)

      // Close the side panel
      setEditingStepIndex(null)
      setIsSidePanelOpen(false)

      // Show rerun choice dialog
      setShowRerunDialog(true)

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

  const handleRerunStepClick = (stepIndex: number) => {
    setStepIndexForRerun(stepIndex)
    setShowRerunDialog(true)
  }

  const handleRerunOnly = async () => {
    if (stepIndexForRerun !== null && handleRerunStep) {
      setShowRerunDialog(false)
      await handleRerunStep(stepIndexForRerun, false)
      setStepIndexForRerun(null)
    }
  }

  const handleRerunAndContinue = async () => {
    if (stepIndexForRerun !== null && handleRerunStep) {
      setShowRerunDialog(false)
      await handleRerunStep(stepIndexForRerun, true)
      setStepIndexForRerun(null)
    }
  }

  const handleCloseRerunDialog = () => {
    setShowRerunDialog(false)
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
      
      <JobOverviewSection
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
      
      {submission?.form_data && (
        <SubmissionSummary submission={submission} onResubmit={handleResubmitClick} resubmitting={resubmitting} />
      )}
      
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

      {/* Rerun Step Dialog */}
      <RerunStepDialog
        isOpen={showRerunDialog}
        onClose={handleCloseRerunDialog}
        onRerunOnly={handleRerunOnly}
        onRerunAndContinue={handleRerunAndContinue}
        stepNumber={stepIndexForRerun !== null ? stepIndexForRerun + 1 : 0}
        stepName={stepIndexForRerun !== null && mergedSteps[stepIndexForRerun] ? mergedSteps[stepIndexForRerun].step_name : undefined}
        isRerunning={rerunningStep !== null}
      />

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
                        onRerunStepClick={handleRerunStepClick}
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
                  <ArtifactGallery items={artifactGalleryItems} loading={loadingArtifacts} onPreview={openPreview} />
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
                <JobDetails 
                  job={job} 
                  workflow={workflow} 
                  hideContainer={true}
                  submission={submission}
                  onRerun={handleResubmitClick}
                  rerunning={resubmitting}
                />
              </div>
            </div>
          )}
        </div>

        {/* Technical Details */}
        <TechnicalDetails job={job} form={form} submission={submission} />
      </div>

      {previewItem && previewObjectUrl && (
        <FullScreenPreviewModal
          isOpen={!!previewItem}
          onClose={closePreview}
          contentType={previewContentType}
          objectUrl={previewObjectUrl}
          fileName={previewFileName}
          artifactId={previewItem?.artifact?.artifact_id}
        />
      )}
    </div>
  )
}


function getJobDuration(job?: Job | null): JobDurationInfo | null {
  // If job is processing but started_at is missing, fall back to created_at
  const startTime = job?.started_at || (job?.status === 'processing' ? job?.created_at : null)
  
  if (!startTime) {
    return null
  }

  const start = new Date(startTime).getTime()
  const endTimestamp = job?.completed_at || job?.failed_at ? new Date(job.completed_at || job.failed_at || '').getTime() : Date.now()
  const seconds = Math.max(0, Math.round((endTimestamp - start) / 1000))

  return {
    seconds,
    label: formatDuration(seconds),
    isLive: !job?.completed_at && !job?.failed_at && job?.status === 'processing',
  }
}


type TabKey = 'execution' | 'artifacts' | 'raw'


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


