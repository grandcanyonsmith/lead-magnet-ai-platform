'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/shared/lib/api'

export default function JobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const data = await api.getJobs({})
        setJobs(data.jobs || [])
      } catch (error) {
        console.error('Failed to load jobs:', error)
      } finally {
        setLoading(false)
      }
    }
    loadJobs()
  }, [])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="h-8 bg-ink-200 rounded w-48 mb-6 animate-pulse"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white rounded-2xl border border-white/60 animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Generated</h1>
          <p className="text-sm text-ink-600 mt-1">Review recent jobs and open completed lead magnets.</p>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-white/60 shadow-soft p-12 text-center">
          <p className="text-ink-600">No generated lead magnets yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const createdAt = job.created_at ? new Date(job.created_at).toLocaleString() : null
            const status =
              job.status === 'completed'
                ? { label: 'Ready', classes: 'bg-emerald-50 text-emerald-700 border-emerald-100' }
                : job.status === 'processing'
                  ? { label: 'Generating...', classes: 'bg-brand-50 text-brand-700 border-brand-100' }
                  : job.status === 'failed'
                    ? { label: 'Error', classes: 'bg-red-50 text-red-700 border-red-100' }
                    : { label: 'Queued', classes: 'bg-amber-50 text-amber-700 border-amber-100' }

            return (
              <button
                key={job.job_id}
                onClick={() => router.push(`/dashboard/jobs/${job.job_id}`)}
                className="w-full bg-white rounded-2xl border border-white/60 p-4 sm:p-5 text-left hover:shadow-md transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border ${status.classes}`}>
                        {status.label}
                      </span>
                      <span className="text-xs text-ink-500 font-mono break-all">{job.job_id}</span>
                    </div>
                    {createdAt && <p className="text-sm text-ink-600">Created {createdAt}</p>}
                  </div>

                  <div className="flex items-center gap-3">
                    {job.output_url && job.status === 'completed' && (
                      <a
                        href={job.output_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center text-brand-600 hover:text-brand-700 font-medium"
                      >
                        View export
                      </a>
                    )}
                    <span className="text-xs text-ink-500">Open</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
