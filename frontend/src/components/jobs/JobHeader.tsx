'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'
import type { Job } from '@/types/job'

interface JobHeaderProps {
  error: string | null
  resubmitting: boolean
  onResubmit: () => void
  job?: Job | null
}

export function JobHeader({ error, job }: JobHeaderProps) {
  const router = useRouter()

  const totalCost = useMemo(() => {
    if (!job?.execution_steps || !Array.isArray(job.execution_steps)) {
      return null
    }

    // Filter to only AI generation steps (which have cost)
    const aiSteps = job.execution_steps.filter(
      (step) => step.step_type === 'ai_generation' || step.step_type === 'workflow_step'
    )

    if (aiSteps.length === 0) {
      return null
    }

    const sum = aiSteps.reduce((acc: number, step) => {
      const cost = step.usage_info?.cost_usd
      if (cost === undefined || cost === null) {
        return acc
      }
      if (typeof cost === 'number') {
        return acc + cost
      }
      if (typeof cost === 'string') {
        const parsed = parseFloat(cost)
        return acc + (Number.isNaN(parsed) ? 0 : parsed)
      }
      return acc
    }, 0)

    // Only show cost if at least one step has usage_info with cost_usd
    const hasCostData = aiSteps.some((step) => {
      const cost = step.usage_info?.cost_usd
      if (cost === undefined || cost === null) return false
      return typeof cost === 'number'
        ? cost > 0
        : parseFloat(String(cost)) > 0
    })

    // If no steps have cost data, return null to hide the display
    if (!hasCostData) {
      return null
    }

    return sum
  }, [job?.execution_steps])

  const handleCopyJobId = async () => {
    if (!job?.job_id) return
    try {
      await navigator.clipboard.writeText(job.job_id)
      toast.success('Job ID copied')
    } catch {
      toast.error('Unable to copy job ID')
    }
  }

  return (
    <div className="mb-8">
      <button
        onClick={() => router.back()}
        className="group inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors touch-target min-h-[44px] sm:min-h-0"
      >
        <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Generated Lead Magnets
      </button>
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 shadow-sm">
          {error}
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Lead Magnet Details
          </h1>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            View progress, artifacts, and step-level details for this generation.
          </p>
        </div>

        {totalCost !== null && (
          <div className="flex items-start justify-end">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-gray-300 bg-white px-4 py-3 shadow">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Total cost
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  ${totalCost.toFixed(4)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

