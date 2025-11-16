import { useState, useEffect } from 'react'
import { api } from '@/shared/lib/api'
import { Workflow } from '@/shared/types'

export function useWorkflowJobs(workflows: Workflow[]) {
  const [workflowJobs, setWorkflowJobs] = useState<Record<string, any[]>>({})
  const [loadingJobs, setLoadingJobs] = useState<Record<string, boolean>>({})

  const loadJobsForWorkflow = async (workflowId: string) => {
    if (loadingJobs[workflowId]) return
    
    setLoadingJobs((prev) => ({ ...prev, [workflowId]: true }))
    try {
      const data = await api.getJobs({ workflow_id: workflowId, limit: 5 })
      setWorkflowJobs((prev) => ({ ...prev, [workflowId]: data.jobs || [] }))
    } catch (error) {
      console.error(`Failed to load jobs for workflow ${workflowId}:`, error)
      setWorkflowJobs((prev) => ({ ...prev, [workflowId]: [] }))
    } finally {
      setLoadingJobs((prev) => ({ ...prev, [workflowId]: false }))
    }
  }

  // Load jobs for each workflow
  useEffect(() => {
    if (workflows.length > 0) {
      workflows.forEach((workflow) => {
        loadJobsForWorkflow(workflow.workflow_id)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflows])

  // Auto-refresh jobs for workflows that have processing jobs
  useEffect(() => {
    const hasProcessingJobs = Object.values(workflowJobs).some((jobs) =>
      jobs.some((job: any) => job.status === 'processing' || job.status === 'pending')
    )

    if (!hasProcessingJobs) return

    const interval = setInterval(() => {
      workflows.forEach((workflow) => {
        const jobs = workflowJobs[workflow.workflow_id] || []
        const hasProcessing = jobs.some((job: any) => job.status === 'processing' || job.status === 'pending')
        if (hasProcessing) {
          loadJobsForWorkflow(workflow.workflow_id)
        }
      })
    }, 5000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflows, workflowJobs])

  return {
    workflowJobs,
    loadingJobs,
    loadJobsForWorkflow,
  }
}

