'use client'

import { useRouter } from 'next/navigation'
import { useJobDetail } from '@/hooks/useJobDetail'
import { useJobExecutionSteps } from '@/hooks/useJobExecutionSteps'
import { JobHeader } from '@/components/jobs/JobHeader'
import { JobDetails } from '@/components/jobs/JobDetails'
import { ExecutionSteps } from '@/components/jobs/ExecutionSteps'
import { TechnicalDetails } from '@/components/jobs/TechnicalDetails'

export default function JobDetailClient() {
  const router = useRouter()
  const {
    job,
    workflow,
    form,
    loading,
    error,
    resubmitting,
    handleResubmit,
  } = useJobDetail()
  
  const {
    showExecutionSteps,
    setShowExecutionSteps,
    expandedSteps,
    toggleStep,
  } = useJobExecutionSteps()

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
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
      <JobHeader error={error} resubmitting={resubmitting} onResubmit={handleResubmit} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <JobDetails job={job} workflow={workflow} />

        {/* AI Instructions (if workflow loaded) */}
        {workflow && workflow.ai_instructions && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Instructions</h2>
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
              {workflow.ai_instructions}
            </div>
          </div>
        )}
      </div>

      {/* Execution Steps */}
      {job.execution_steps && Array.isArray(job.execution_steps) && job.execution_steps.length > 0 && (
        <ExecutionSteps
          steps={job.execution_steps}
          expandedSteps={expandedSteps}
          showExecutionSteps={showExecutionSteps}
          onToggleShow={() => setShowExecutionSteps(!showExecutionSteps)}
          onToggleStep={toggleStep}
          onCopy={copyToClipboard}
        />
      )}

      {/* Technical Details */}
      <TechnicalDetails job={job} form={form} />
    </div>
  )
}

