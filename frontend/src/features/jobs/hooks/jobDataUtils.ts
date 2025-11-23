'use client'

import { api } from '@/shared/lib/api'

/**
 * Helper function to temporarily remove agency_selected_customer_id for API calls
 * This ensures resources are fetched from the user's own customer, not filtered by agency view
 */
export async function withOwnCustomerId<T>(fn: () => Promise<T>): Promise<T> {
  const savedCustomerId = typeof window !== 'undefined' 
    ? localStorage.getItem('agency_selected_customer_id')
    : null
  
  if (savedCustomerId && typeof window !== 'undefined') {
    localStorage.removeItem('agency_selected_customer_id')
  }

  try {
    return await fn()
  } finally {
    // Restore the saved customer ID if it existed
    if (savedCustomerId && typeof window !== 'undefined') {
      localStorage.setItem('agency_selected_customer_id', savedCustomerId)
    }
  }
}

/**
 * Load workflow data by workflow ID
 * 
 * @param workflowId - Workflow ID to load
 * @param setWorkflow - State setter for workflow
 */
export async function loadWorkflowData(workflowId: string, setWorkflow: (data: any) => void): Promise<void> {
  try {
    const workflowData = await withOwnCustomerId(() => api.getWorkflow(workflowId))
    setWorkflow(workflowData)
  } catch (err) {
    console.error('Failed to load workflow:', err)
    // Continue without workflow data
  }
}

/**
 * Load submission and associated form data
 * 
 * @param submissionId - Submission ID to load
 * @param setSubmission - State setter for submission
 * @param setForm - State setter for form
 */
export async function loadSubmissionData(
  submissionId: string,
  setSubmission: (data: any) => void,
  setForm: (data: any) => void
): Promise<void> {
  try {
    const submissionData = await withOwnCustomerId(() => api.getSubmission(submissionId))
    setSubmission(submissionData)
    
    if (submissionData.form_id) {
      try {
        const formData = await withOwnCustomerId(() => api.getForm(submissionData.form_id))
        setForm(formData)
      } catch (err) {
        console.error('Failed to load form:', err)
        // Continue without form data
      }
    }
  } catch (err) {
    console.error('Failed to load submission:', err)
    // Continue without submission data
  }
}

