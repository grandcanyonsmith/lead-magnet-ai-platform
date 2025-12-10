/**
 * Hook for fetching and organizing image artifacts by step order
 */

import { useState, useEffect, useMemo, useRef } from 'react'
import { api } from '@/lib/api'
import { Artifact } from '@/types/artifact'
import { MergedStep } from '@/types/job'

interface UseImageArtifactsOptions {
  jobId?: string
  steps: MergedStep[]
}

/**
 * Fetch and organize image artifacts by step order
 */
export function useImageArtifacts(options: UseImageArtifactsOptions) {
  const { jobId, steps } = options
  const [imageArtifactsByStep, setImageArtifactsByStep] = useState<Map<number, Artifact[]>>(new Map())
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [loading, setLoading] = useState(false)
  
  // Use ref to track the last jobId we fetched artifacts for
  const lastFetchedJobIdRef = useRef<string | undefined>(undefined)
  
  // Create a stable reference for steps by serializing key properties
  // This prevents re-fetching when steps array reference changes but content is the same
  const stepsKey = useMemo(() => {
    if (!steps || steps.length === 0) return ''
    return steps.map(s => `${s.step_order}-${s.started_at || ''}`).join(',')
  }, [steps])

  // Fetch artifacts only when jobId changes
  useEffect(() => {
    const fetchImageArtifacts = async () => {
      if (!jobId) return
      
      // Skip if we already fetched artifacts for this jobId
      if (lastFetchedJobIdRef.current === jobId) {
        return
      }

      try {
        setLoading(true)
        const response = await api.getArtifacts({ 
          job_id: jobId,
          limit: 200 
        })
        
        const allArtifacts = response.artifacts || []
        setArtifacts(allArtifacts)
        lastFetchedJobIdRef.current = jobId
      } catch (error) {
        console.error('Failed to fetch image artifacts:', error)
        // Don't show error to user, just silently fail - images will fall back to image_urls
      } finally {
        setLoading(false)
      }
    }

    fetchImageArtifacts()
  }, [jobId])

  // Re-organize artifacts by step when steps change (but don't re-fetch)
  useEffect(() => {
    if (artifacts.length === 0 || steps.length === 0) {
      setImageArtifactsByStep(new Map())
      return
    }

    const imageArtifacts = artifacts.filter((artifact) => {
      const type = artifact.artifact_type?.toLowerCase() || artifact.content_type?.toLowerCase() || ''
      return type.includes('image')
    })
    
    // Group artifacts by step order based on filename pattern or created_at timestamp
    const artifactsByStep = new Map<number, Artifact[]>()
    
    // Sort steps by step_order for matching
    const sortedSteps = [...steps].sort((a, b) => {
      const orderA = a.step_order ?? 0
      const orderB = b.step_order ?? 0
      return orderA - orderB
    })
    
    imageArtifacts.forEach((artifact: Artifact) => {
      // Try to extract step order from filename
      const fileName = artifact.file_name || artifact.artifact_name || ''
      const stepMatch = fileName.match(/step[_\s](\d+)/i)
      
      if (stepMatch) {
        const stepOrder = parseInt(stepMatch[1], 10)
        if (!artifactsByStep.has(stepOrder)) {
          artifactsByStep.set(stepOrder, [])
        }
        artifactsByStep.get(stepOrder)!.push(artifact)
      } else {
        // Fallback: try to match by timestamp proximity to step execution
        if (artifact.created_at) {
          const artifactTime = new Date(artifact.created_at).getTime()
          
          for (const step of sortedSteps) {
            if (step.started_at) {
              const stepTime = new Date(step.started_at).getTime()
              const timeDiff = Math.abs(artifactTime - stepTime)
              
              // If artifact was created within 5 minutes of step execution, associate it
              if (timeDiff < 5 * 60 * 1000) {
                const stepOrder = step.step_order ?? 0
                if (!artifactsByStep.has(stepOrder)) {
                  artifactsByStep.set(stepOrder, [])
                }
                artifactsByStep.get(stepOrder)!.push(artifact)
                break
              }
            }
          }
        }
      }
    })
    
    setImageArtifactsByStep(artifactsByStep)
  }, [artifacts, stepsKey])

  return {
    imageArtifactsByStep,
    artifacts,
    loading,
  }
}

