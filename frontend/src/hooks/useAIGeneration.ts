'use client'

import { useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { WorkflowStep } from '@/app/dashboard/workflows/components/WorkflowStepEditor'

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
      fields: any[]
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

    console.log('[Workflow Generation] Starting AI generation...', {
      prompt: description.trim(),
      timestamp: new Date().toISOString(),
    })

    setIsGenerating(true)
    setError(null)
    setGenerationStatus('Starting workflow generation...')
    setResult(null)

    try {
      const startTime = Date.now()
      
      // Step 1: Initiate async generation (returns 202 with job_id)
      const initResponse = await api.generateWorkflowWithAI(description.trim(), model)
      
      // Check if we got a job_id (async flow)
      if (initResponse.job_id) {
        const jobId = initResponse.job_id
        console.log('[Workflow Generation] Job created', { jobId, status: initResponse.status })
        
        setGenerationStatus('Generating your lead magnet configuration... This may take a minute.')
        
        // Step 2: Poll for completion
        let attempts = 0
        const maxAttempts = 900 // 15 minutes max (1 second intervals)
        let pollResult: any = null
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
          
          const statusResponse = await api.getWorkflowGenerationStatus(jobId)
          console.log('[Workflow Generation] Polling status', { 
            jobId, 
            status: statusResponse.status, 
            attempt: attempts + 1 
          })
          
          if (statusResponse.status === 'completed') {
            pollResult = statusResponse.result
            console.log('[Workflow Generation] Job completed', { result: pollResult })
            break
          } else if (statusResponse.status === 'failed') {
            throw new Error(statusResponse.error_message || 'Workflow generation failed')
          } else if (statusResponse.status === 'processing') {
            setGenerationStatus(`Processing... (${attempts + 1}s)`)
          } else {
            setGenerationStatus(`Preparing... (${attempts + 1}s)`)
          }
          
          attempts++
        }
        
        if (!pollResult) {
          throw new Error('Workflow generation timed out. Please try again.')
        }
        
        const duration = Date.now() - startTime
        console.log('[Workflow Generation] Success!', {
          duration: `${duration}ms`,
          workflow: pollResult.workflow,
          template: pollResult.template,
          form: pollResult.form,
          timestamp: new Date().toISOString(),
        })

        setGenerationStatus('Generation complete!')
        setResult(pollResult)
        
        setTimeout(() => {
          setGenerationStatus(null)
        }, 3000)
        
        return pollResult
      } else {
        // Fallback: synchronous response (legacy behavior)
        const syncResult = initResponse
        const duration = Date.now() - startTime

        console.log('[Workflow Generation] Success!', {
          duration: `${duration}ms`,
          workflow: syncResult.workflow,
          template: syncResult.template,
          form: syncResult.form,
          timestamp: new Date().toISOString(),
        })

        setGenerationStatus('Generation complete!')
        setResult(syncResult)
        
        setTimeout(() => {
          setGenerationStatus(null)
        }, 3000)
        
        return syncResult
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

