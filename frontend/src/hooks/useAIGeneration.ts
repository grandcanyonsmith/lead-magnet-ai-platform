'use client'

import { useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { AIModel } from '@/types'
import { WorkflowStep } from '@/types/workflow'
import { FormField } from '@/types/form'

export interface AIGenerationResult {
  workflow: {
    workflow_name?: string
    workflow_description?: string
    research_instructions?: string
    steps?: WorkflowStep[]
  }
  template: {
    template_name?: string
    template_description?: string
    html_content?: string
    placeholder_tags?: string[]
  }
  form: {
    form_name?: string
    public_slug?: string
    form_fields_schema?: {
      fields: FormField[]
    }
  }
}

export function useAIGeneration() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AIGenerationResult | null>(null)

  const generateWorkflow = useCallback(async (description: string, model: string = 'gpt-5') => {
    if (!description.trim()) {
      setError('Please describe what you want to build a lead magnet for')
      return null
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[Workflow Generation] Starting AI generation...', {
        prompt: description.trim(),
        timestamp: new Date().toISOString(),
      })
    }

    setIsGenerating(true)
    setError(null)
    setGenerationStatus('Creating your lead magnet...')
    setResult(null)

    try {
      const startTime = Date.now()
      
      // Generate webhook URL template (backend will replace {jobId} with actual jobId)
      const webhookUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/api/webhooks/workflow-completion/{jobId}`
        : undefined
      
      // Step 1: Initiate async generation (returns immediately with job_id)
      const initResponse = await api.generateWorkflowWithAI({
        description: description.trim(),
        model: model as AIModel | undefined,
        webhook_url: webhookUrl,
      })
      
      // Check if we got a job_id (async flow)
      if (initResponse.job_id) {
        const jobId = initResponse.job_id
        if (process.env.NODE_ENV === 'development') {
          console.log('[Workflow Generation] Job created', { jobId, status: initResponse.status })
        }
        
        setGenerationStatus('Creating your lead magnet... This may take a minute.')
        
        // Store job_id for webhook handler
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(`workflow_generation_job_${jobId}`, JSON.stringify({
            jobId,
            description: description.trim(),
            model,
            createdAt: new Date().toISOString(),
          }))
        }
        
        // Return job_id - the webhook will trigger navigation
        return { job_id: jobId, status: 'pending' } as any
      } else {
        // Fallback: synchronous response (legacy behavior)
        const syncResult = initResponse
        if (!syncResult.result) {
          throw new Error('No result in response')
        }
        const duration = Date.now() - startTime

        if (process.env.NODE_ENV === 'development') {
          console.log('[Workflow Generation] Success!', {
            duration: `${duration}ms`,
            workflow: syncResult.result.workflow,
            template: syncResult.result.template,
            form: syncResult.result.form,
            timestamp: new Date().toISOString(),
          })
        }

        setGenerationStatus('Generation complete!')
        setResult(syncResult.result)
        
        setTimeout(() => {
          setGenerationStatus(null)
        }, 3000)
        
        return syncResult.result
      }
    } catch (err: any) {
      console.error('[Workflow Generation] Failed:', err)
      setError(err.response?.data?.message || err.message || 'Failed to generate lead magnet with AI')
      setGenerationStatus(null)
      return null
    } finally {
      setIsGenerating(false)
    }
  }, [])

  const reset = useCallback(() => {
    setIsGenerating(false)
    setGenerationStatus(null)
    setError(null)
    setResult(null)
  }, [])

  return {
    generateWorkflow,
    isGenerating,
    generationStatus,
    error,
    result,
    reset,
  }
}

