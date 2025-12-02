import { FiCopy, FiRefreshCw } from 'react-icons/fi'
import { formatRelativeTime } from '@/utils/date'
import type { FormSubmission } from '@/types/form'
import toast from 'react-hot-toast'

interface SubmissionSummaryProps {
  submission: FormSubmission
  onResubmit: () => void
  resubmitting: boolean
}

export function SubmissionSummary({ submission, onResubmit, resubmitting }: SubmissionSummaryProps) {
  const submittedLabel = submission.created_at ? formatRelativeTime(submission.created_at) : null
  const entries = Object.entries(submission.form_data || {})

  const handleCopyAll = async () => {
    try {
      const text = entries
        .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
        .join('\n')
      if (navigator?.clipboard) {
        await navigator.clipboard.writeText(text)
        toast.success('Submission copied')
      } else {
        throw new Error('Clipboard not available')
      }
    } catch {
      toast.error('Unable to copy submission')
    }
  }

  return (
    <section className="mb-4 sm:mb-6">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 p-4 sm:p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Submitted Answers</p>
            <h2 className="text-lg font-semibold text-gray-900">Form submission</h2>
            {submittedLabel && <p className="text-sm text-gray-500">Submitted {submittedLabel}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopyAll}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              <FiCopy className="h-4 w-4" />
              Copy all
            </button>
            <button
              type="button"
              onClick={onResubmit}
              disabled={resubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiRefreshCw className={`h-4 w-4 ${resubmitting ? 'animate-spin text-white/80' : ''}`} />
              Resubmit
            </button>
          </div>
        </div>
        <div className="border-t border-gray-100">
          {entries.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500">No submission data available</p>
          ) : (
            <dl className="divide-y divide-gray-100">
              {entries.map(([key, value]) => (
                <div key={key} className="px-4 py-3 sm:px-6 sm:py-4">
                  <dt className="text-sm font-medium text-gray-700">{key.replace(/_/g, ' ')}</dt>
                  <dd className="mt-1 text-sm text-gray-900 break-words">
                    {typeof value === 'string' ? value : JSON.stringify(value)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </section>
  )
}
