'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { extractJobId } from '@/features/jobs/utils/jobIdExtraction'

/**
 * Hook to manage job ID extraction and updates from URL params
 * 
 * Features:
 * - Extracts jobId from URL params using extractJobId utility
 * - Updates jobId when params change (for client-side navigation)
 * - Handles invalid job IDs
 * 
 * @returns Object with jobId
 */
export function useJobId() {
  const params = useParams()
  const [jobId, setJobId] = useState<string>(() => extractJobId(params))

  // Update jobId when params change (for client-side navigation)
  useEffect(() => {
    const newJobId = extractJobId(params)
    if (newJobId && newJobId !== jobId && newJobId.trim() !== '' && newJobId !== '_') {
      setJobId(newJobId)
    }
  }, [params?.id, params?.slug, jobId, params])

  return { jobId }
}

