'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useJobDetail } from '@/hooks/useJobDetail'
import { useJobExecutionSteps } from '@/hooks/useJobExecutionSteps'
import { JobHeader } from '@/components/jobs/JobHeader'
import { JobDetails } from '@/components/jobs/JobDetails'
import { ExecutionSteps } from '@/components/jobs/ExecutionSteps'
import { TechnicalDetails } from '@/components/jobs/TechnicalDetails'
import { ResubmitModal } from '@/components/jobs/ResubmitModal'

export default function JobDetailClient() {
  const router = useRouter()
  const [showResubmitModal, setShowResubmitModal] = useState(false)
  const {
    job,
    workflow,
    form,
    submission,
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

  const handleResubmitClick = () => {
    setShowResubmitModal(true)
  }

  const handleResubmitConfirm = async () => {
    await handleResubmit()
    setShowResubmitModal(false)
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
      <JobHeader error={error} resubmitting={resubmitting} onResubmit={handleResubmitClick} />
      
      <ResubmitModal
        isOpen={showResubmitModal}
        onClose={() => setShowResubmitModal(false)}
        onConfirm={handleResubmitConfirm}
        isResubmitting={resubmitting}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <JobDetails job={job} workflow={workflow} />

        {/* Form Submission Details */}
        {submission && submission.submission_data ? (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Form Submission Details</h2>
            <div className="space-y-3">
              {Object.entries(submission.submission_data).map(([key, value]: [string, any]) => (
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
          </div>
        ) : submission ? (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Form Submission Details</h2>
            <p className="text-sm text-gray-500">No submission data available</p>
          </div>
        ) : null}
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

