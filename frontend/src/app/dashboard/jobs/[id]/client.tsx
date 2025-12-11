'use client'

import React, { useState, useRef, useMemo, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FiChevronDown, FiChevronUp, FiCopy } from 'react-icons/fi'
import { toast } from 'react-hot-toast'

import { useJobDetail } from '@/hooks/useJobDetail'
import { useJobExecutionSteps } from '@/hooks/useJobExecutionSteps'
import { useMergedSteps } from '@/hooks/useMergedSteps'
import { useImageArtifacts } from '@/hooks/useImageArtifacts'
import { usePreviewModal } from '@/hooks/usePreviewModal'

import { api } from '@/lib/api'
import { buildArtifactGalleryItems } from '@/utils/jobs/artifacts'
import { summarizeStepProgress } from '@/utils/jobs/steps'
import { formatRelativeTime, formatDuration } from '@/utils/date'

import { JobHeader } from '@/components/jobs/JobHeader'
import { JobDetails } from '@/components/jobs/JobDetails'
import { ExecutionSteps } from '@/components/jobs/ExecutionSteps'
import { TechnicalDetails } from '@/components/jobs/TechnicalDetails'
import { ResubmitModal } from '@/components/jobs/ResubmitModal'
import { RerunStepDialog } from '@/components/jobs/RerunStepDialog'
import { ArtifactGallery } from '@/components/jobs/detail/ArtifactGallery'
import { FullScreenPreviewModal } from '@/components/ui/FullScreenPreviewModal'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'


import FlowchartSidePanel from '@/app/dashboard/workflows/components/FlowchartSidePanel'
import { JobOverviewSection, JobDurationInfo } from '@/components/jobs/detail/JobOverviewSection'
import { SubmissionSummary } from '@/components/jobs/detail/SubmissionSummary'
import { JobTrackingStats } from '@/components/tracking/JobTrackingStats'

import type {
  ArtifactGalleryItem,
  Job,
  JobStepSummary,
  MergedStep,
} from '@/types/job'
import type { WorkflowStep } from '@/types'
import type { Workflow } from '@/types/workflow'
import type { FormSubmission } from '@/types/form'
import type { Artifact } from '@/types/artifact'

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

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

  const { previewItem, openPreview, closePreview } =
    usePreviewModal<ArtifactGalleryItem>()

  const artifactGalleryItems = useMemo(
    () =>
      buildArtifactGalleryItems({
        job,
        artifacts: jobArtifacts,
        steps: mergedSteps,
      }),
    [job, jobArtifacts, mergedSteps]
  )

  const stepsSummary = useMemo<JobStepSummary>(
    () => summarizeStepProgress(mergedSteps),
    [mergedSteps]
  )

  const jobDuration = useMemo(() => getJobDuration(job), [job])

  const lastUpdatedLabel = useMemo(
    () => (job?.updated_at ? formatRelativeTime(job.updated_at) : null),
    [job?.updated_at]
  )

  const lastRefreshedLabel = useMemo(
    () => (lastLoadedAt ? formatRelativeTime(lastLoadedAt.toISOString()) : null),
    [lastLoadedAt]
  )

  const previewObjectUrl =
    previewItem?.artifact?.object_url ||
    previewItem?.artifact?.public_url ||
    previewItem?.url

  const previewContentType =
    previewItem?.artifact?.content_type ||
    (previewItem?.kind === 'imageUrl' ? 'image/png' : undefined)

  const previewFileName =
    previewItem?.artifact?.file_name ||
    previewItem?.artifact?.artifact_name ||
    previewItem?.label

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const handleResubmitClick = () => setShowResubmitModal(true)

  const handleResubmitConfirm = async () => {
    await handleResubmit()
    setShowResubmitModal(false)
  }

  const handleEditStep = (stepIndex: number) => {
    setEditingStepIndex(stepIndex)
    setIsSidePanelOpen(true)
    latestStepUpdateRef.current = null
  }

  const handleSaveStep = async (updatedStep: WorkflowStep) => {
    if (!workflow || editingStepIndex === null || !workflow.steps) {
      toast.error('Unable to save: Workflow data not available')
      return
    }

    try {
      const updatedSteps = [...workflow.steps]
      const originalStep = updatedSteps[editingStepIndex]

      updatedSteps[editingStepIndex] = {
        ...originalStep,
        ...updatedStep,
      }

      // Update workflow
      await api.updateWorkflow(workflow.workflow_id, {
        steps: updatedSteps,
      })

      toast.success('Step updated successfully')

      setStepIndexForRerun(editingStepIndex)

      setEditingStepIndex(null)
      setIsSidePanelOpen(false)

      setShowRerunDialog(true)

      router.refresh()
    } catch (error: any) {
      console.error('Failed to save step:', error)
      toast.error('Failed to save step. Please try again.')
    }
  }

  const handleCancelEdit = async () => {
    if (latestStepUpdateRef.current && editingStepIndex !== null) {
      const currentStep = workflow?.steps?.[editingStepIndex]
      const hasChanges =
        currentStep &&
        JSON.stringify(currentStep) !== JSON.stringify(latestStepUpdateRef.current)

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
    if (stepIndexForRerun !== null) {
      setShowRerunDialog(false)
      await handleRerunStep(stepIndexForRerun, false)
      setStepIndexForRerun(null)
    }
  }

  const handleRerunAndContinue = async () => {
    if (stepIndexForRerun !== null) {
      setShowRerunDialog(false)
      await handleRerunStep(stepIndexForRerun, true)
      setStepIndexForRerun(null)
    }
  }

  const handleCloseRerunDialog = () => {
    setShowRerunDialog(false)
    setStepIndexForRerun(null)
  }

  // ---------------------------------------------------------------------------
  // Loading / Error States
  // ---------------------------------------------------------------------------

  if (loading) {
    return <LoadingState />
  }

  if (error && !job) {
    return <ErrorState message={error} />
  }

  if (!job) {
    return null
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const errorFallback = (
    <div className="border border-red-300 rounded-lg p-6 bg-red-50">
      <p className="text-red-800 font-medium">Error loading job details</p>
      <p className="text-red-600 text-sm mt-1">Please refresh the page or try again.</p>
    </div>
  )

  return (
    <ErrorBoundary fallback={errorFallback}>
      <div>
        <JobHeader
          error={error}
          resubmitting={resubmitting}
          onResubmit={handleResubmitClick}
          job={job}
        />

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
          <SubmissionSummary
            submission={submission}
            onResubmit={handleResubmitClick}
            resubmitting={resubmitting}
          />
        )}

        <ResubmitModal
          isOpen={showResubmitModal}
          onClose={() => setShowResubmitModal(false)}
          onConfirm={handleResubmitConfirm}
          isResubmitting={resubmitting}
        />

        {/* -------------------------------------- */}
        {/* Step Edit Side Panel */}
        {/* -------------------------------------- */}

        {editingStepIndex !== null && workflow?.steps?.[editingStepIndex] && (
          <FlowchartSidePanel
            step={workflow.steps[editingStepIndex]}
            index={editingStepIndex}
            totalSteps={workflow.steps.length}
            allSteps={workflow.steps}
            isOpen={isSidePanelOpen}
            onClose={handleCancelEdit}
            onChange={(index, updatedStep) => {
              latestStepUpdateRef.current = updatedStep
            }}
            onDelete={() =>
              toast.error('Cannot delete steps from execution viewer.')
            }
            onMoveUp={() =>
              toast.error('Cannot reorder steps from execution viewer.')
            }
            onMoveDown={() =>
              toast.error('Cannot reorder steps from execution viewer.')
            }
            workflowId={workflow.workflow_id}
          />
        )}

        {/* Rerun dialog */}
        <RerunStepDialog
          isOpen={showRerunDialog}
          onClose={handleCloseRerunDialog}
          onRerunOnly={handleRerunOnly}
          onRerunAndContinue={handleRerunAndContinue}
          stepNumber={stepIndexForRerun !== null ? stepIndexForRerun + 1 : 0}
          stepName={
            stepIndexForRerun !== null
              ? mergedSteps[stepIndexForRerun]?.step_name
              : undefined
          }
          isRerunning={rerunningStep !== null}
        />

        {/* Tabs */}
        <JobTabs
          job={job}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          mergedSteps={mergedSteps}
          artifactGalleryItems={artifactGalleryItems}
          expandedSteps={expandedSteps}
          toggleStep={toggleStep}
          showExecutionSteps={showExecutionSteps}
          setShowExecutionSteps={setShowExecutionSteps}
          executionStepsError={executionStepsError}
          imageArtifactsByStep={imageArtifactsByStep}
          loadingArtifacts={loadingArtifacts}
          onCopy={copyToClipboard}
          onEditStep={handleEditStep}
          onRerunStepClick={handleRerunStepClick}
          rerunningStep={rerunningStep}
          openPreview={openPreview}
        />

        {/* Details + Technical sections */}
        <DetailsSection
          showDetails={showDetails}
          setShowDetails={setShowDetails}
          job={job}
          workflow={workflow}
          submission={submission}
          handleResubmitClick={handleResubmitClick}
          resubmitting={resubmitting}
        />

        <TechnicalDetails job={job} form={form} submission={submission} />

        {/* Artifact Preview Modal */}
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
    </ErrorBoundary>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getJobDuration(job?: Job | null): JobDurationInfo | null {
  const shouldFallbackToCreatedAt =
    job?.status === 'processing' ||
    job?.status === 'completed' ||
    job?.status === 'failed'

  const startTime =
    job?.started_at ||
    (shouldFallbackToCreatedAt ? job?.created_at : null)

  if (!startTime) return null

  const start = new Date(startTime).getTime()
  const endTime = job?.completed_at || job?.failed_at
  const endTimestamp = endTime ? new Date(endTime).getTime() : Date.now()

  const seconds = Math.max(0, Math.round((endTimestamp - start) / 1000))

  return {
    seconds,
    label: formatDuration(seconds),
    isLive:
      !job?.completed_at &&
      !job?.failed_at &&
      job?.status === 'processing',
  }
}

type TabKey = 'execution' | 'artifacts' | 'tracking' | 'raw'

// ---------------------------------------------------------------------------
// Job Tabs Component
// ---------------------------------------------------------------------------

interface JobTabsProps {
  job: Job
  activeTab: TabKey
  setActiveTab: (tab: TabKey) => void
  mergedSteps: MergedStep[]
  artifactGalleryItems: ArtifactGalleryItem[]
  expandedSteps: Set<number>
  toggleStep: (stepOrder: number) => void
  showExecutionSteps: boolean
  setShowExecutionSteps: (show: boolean) => void
  executionStepsError: string | null
  imageArtifactsByStep: Map<number, Artifact[]>
  loadingArtifacts: boolean
  onCopy: (text: string) => void
  onEditStep: (stepIndex: number) => void
  onRerunStepClick: (stepIndex: number) => void
  rerunningStep: number | null
  openPreview: (item: ArtifactGalleryItem) => void
}

function JobTabs({
  job,
  activeTab,
  setActiveTab,
  mergedSteps,
  artifactGalleryItems,
  expandedSteps,
  toggleStep,
  showExecutionSteps,
  setShowExecutionSteps,
  executionStepsError,
  imageArtifactsByStep,
  loadingArtifacts,
  onCopy,
  onEditStep,
  onRerunStepClick,
  rerunningStep,
  openPreview,
}: JobTabsProps) {
  const tabs: { id: TabKey; label: string }[] = [
    { id: 'execution', label: 'Execution' },
    { id: 'artifacts', label: 'Artifacts' },
    { id: 'tracking', label: 'Tracking' },
    { id: 'raw', label: 'Raw JSON' },
  ]

  return (
    <div className="mt-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6" role="tabpanel">
        {activeTab === 'execution' && (
          <ExecutionSteps
            steps={mergedSteps}
            expandedSteps={expandedSteps}
            showExecutionSteps={showExecutionSteps}
            onToggleShow={() => setShowExecutionSteps(!showExecutionSteps)}
            onToggleStep={toggleStep}
            onCopy={onCopy}
            jobStatus={job.status}
            onEditStep={onEditStep}
            canEdit={true}
            imageArtifactsByStep={imageArtifactsByStep}
            loadingImageArtifacts={loadingArtifacts}
            onRerunStepClick={onRerunStepClick}
            rerunningStep={rerunningStep}
          />
        )}

        {activeTab === 'artifacts' && (
          <div id="job-tab-panel-artifacts">
            <ArtifactGallery
              items={artifactGalleryItems}
              loading={loadingArtifacts}
              onPreview={openPreview}
            />
          </div>
        )}

        {activeTab === 'tracking' && (
          <div id="job-tab-panel-tracking">
            <JobTrackingStats jobId={job.job_id} />
          </div>
        )}

        {activeTab === 'raw' && <RawJsonPanel data={job} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Details Section Component
// ---------------------------------------------------------------------------

interface DetailsSectionProps {
  showDetails: boolean
  setShowDetails: (show: boolean) => void
  job: Job
  workflow: Workflow | null
  submission: FormSubmission | null
  handleResubmitClick: () => void
  resubmitting: boolean
}

function DetailsSection({
  showDetails,
  setShowDetails,
  job,
  workflow,
  submission,
  handleResubmitClick,
  resubmitting,
}: DetailsSectionProps) {
  if (!showDetails) {
    return (
      <div className="mt-6">
        <button
          onClick={() => setShowDetails(true)}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          Show details
        </button>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Details</h2>
        <button
          onClick={() => setShowDetails(false)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Hide details
        </button>
      </div>
      <JobDetails
        job={job}
        workflow={workflow}
        submission={submission}
        onRerun={handleResubmitClick}
        rerunning={resubmitting}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Raw JSON Panel
// ---------------------------------------------------------------------------

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
      await navigator.clipboard.writeText(jsonString)
      toast.success('Execution JSON copied')
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
          className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold hover:bg-gray-800"
        >
          <FiCopy className="h-4 w-4" />
          Copy JSON
        </button>
      </div>

      <pre className="overflow-auto text-xs leading-relaxed p-4 text-gray-100">
        {jsonString}
      </pre>
    </div>
  )
}
