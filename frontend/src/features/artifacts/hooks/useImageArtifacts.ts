/**
 * Hook for fetching and organizing image artifacts by step order
 */

import { useState, useEffect } from 'react'
import { api } from '@/shared/lib/api'
import { Artifact } from '@/features/artifacts/types'
import { MergedStep } from '@/features/jobs/types'

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
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchImageArtifacts = async () => {
      if (!jobId) return

      try {
        setLoading(true)
        const response = await api.getArtifacts({ 
          job_id: jobId, 
          artifact_type: 'image',
          limit: 100 
        })
        
        const imageArtifacts = response.artifacts || []
        
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
      } catch (error) {
        console.error('Failed to fetch image artifacts:', error)
        // Don't show error to user, just silently fail - images will fall back to image_urls
      } finally {
        setLoading(false)
      }
    }

    fetchImageArtifacts()
  }, [jobId, steps])

  return {
    imageArtifactsByStep,
    loading,
  }
}

