/**
 * @jest-environment jsdom
 * 
 * Unit tests for useJobData hook.
 */

import { renderHook, waitFor } from '@testing-library/react'
import { useJobData } from '@/features/jobs/hooks/useJobData'
import { api } from '@/shared/lib/api'
import * as jobDataUtils from '@/features/jobs/hooks/jobDataUtils'

jest.mock('@/shared/lib/api')
jest.mock('@/features/jobs/hooks/jobDataUtils')

describe('useJobData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should load job data successfully', async () => {
    const mockJob = { job_id: 'job123', status: 'completed' }
    const mockWorkflow = { workflow_id: 'wf123' }
    const mockSubmission = { submission_id: 'sub123' }
    const mockForm = { form_id: 'form123' }
    const mockExecutionSteps = [{ step_order: 1 }]

    ;(jobDataUtils.withOwnCustomerId as jest.Mock).mockImplementation((fn) => fn())
    ;(api.getJob as jest.Mock).mockResolvedValue(mockJob)
    ;(api.getExecutionSteps as jest.Mock).mockResolvedValue(mockExecutionSteps)
    ;(jobDataUtils.loadWorkflowData as jest.Mock).mockResolvedValue(mockWorkflow)
    ;(jobDataUtils.loadSubmissionData as jest.Mock).mockResolvedValue({
      submission: mockSubmission,
      form: mockForm,
    })

    const { result } = renderHook(() => useJobData({ jobId: 'job123' }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.job).toEqual(mockJob)
    expect(result.current.workflow).toEqual(mockWorkflow)
    expect(result.current.submission).toEqual(mockSubmission)
    expect(result.current.form).toEqual(mockForm)
    expect(result.current.error).toBeNull()
  })

  it('should handle loading state', () => {
    ;(api.getJob as jest.Mock).mockImplementation(() => new Promise(() => {}))

    const { result } = renderHook(() => useJobData({ jobId: 'job123' }))

    expect(result.current.loading).toBe(true)
    expect(result.current.job).toBeNull()
  })

  it('should handle error state', async () => {
    const error = new Error('Failed to load job')
    ;(jobDataUtils.withOwnCustomerId as jest.Mock).mockImplementation((fn) => fn())
    ;(api.getJob as jest.Mock).mockRejectedValue(error)

    const { result } = renderHook(() => useJobData({ jobId: 'job123' }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Failed to load job')
    expect(result.current.job).toBeNull()
  })

  it('should clear state when jobId changes', () => {
    const { result, rerender } = renderHook(
      ({ jobId }) => useJobData({ jobId }),
      { initialProps: { jobId: 'job123' } }
    )

    rerender({ jobId: 'job456' })

    expect(result.current.job).toBeNull()
    expect(result.current.workflow).toBeNull()
  })

  it('should provide loadJob function', () => {
    const { result } = renderHook(() => useJobData({ jobId: 'job123' }))

    expect(typeof result.current.loadJob).toBe('function')
  })
})

