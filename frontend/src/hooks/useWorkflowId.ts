'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'

/**
 * Hook to extract workflow ID from params/URL
 * Handles Vercel rewrite scenarios where param might be '_'
 */
export function useWorkflowId(): string {
  const params = useParams()
  
  const getWorkflowId = useCallback(() => {
    const paramId = params?.id as string
    if (paramId && paramId !== '_') {
      return paramId
    }
    // Fallback: extract from browser URL
    if (typeof window !== 'undefined') {
      const pathMatch = window.location.pathname.match(/\/dashboard\/workflows\/([^/]+)/)
      if (pathMatch && pathMatch[1] && pathMatch[1] !== '_') {
        return pathMatch[1]
      }
    }
    return paramId || ''
  }, [params?.id])
  
  const [workflowId, setWorkflowId] = useState<string>(() => {
    const paramId = params?.id as string
    if (paramId && paramId !== '_') {
      return paramId
    }
    if (typeof window !== 'undefined') {
      const pathMatch = window.location.pathname.match(/\/dashboard\/workflows\/([^/]+)/)
      if (pathMatch && pathMatch[1] && pathMatch[1] !== '_') {
        return pathMatch[1]
      }
    }
    return paramId || ''
  })
  
  useEffect(() => {
    const newId = getWorkflowId()
    if (newId && newId !== workflowId && newId.trim() !== '' && newId !== '_') {
      setWorkflowId(newId)
    }
  }, [params?.id, workflowId, getWorkflowId])
  
  return workflowId
}

