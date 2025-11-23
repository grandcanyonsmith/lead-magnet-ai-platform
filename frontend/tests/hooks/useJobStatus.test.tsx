/**
 * @jest-environment jsdom
 * 
 * Unit tests for useJobStatus hook.
 */

import { renderHook, waitFor } from '@testing-library/react'
import { useJobStatus } from '@/features/jobs/hooks/useJobStatus'
import { api } from '@/shared/lib/api'
import * as jobDataUtils from '@/features/jobs/hooks/jobDataUtils'

jest.mock('@/shared/lib/api')
jest.mock('@/features/jobs/hooks/jobDataUtils')

describe('useJobStatus', () => {
  beforeEach(() => {
    jest.clearAllTimers()
    jest.useFakeTimers()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should poll when job is processing', async () => {
    const mockJob = { job_id: 'job123', status: 'processing' }
    const mockExecutionSteps = [{ step_order: 1 }]

    ;(jobDataUtils.withOwnCustomerId as jest.Mock).mockImplementation((fn) => fn())
    ;(api.getJob as jest.Mock).mockResolvedValue(mockJob)
    ;(api.getExecutionSteps as jest.Mock).mockResolvedValue(mockExecutionSteps)

    const mockSetJob = jest.fn()
    const mockLoadExecutionSteps = jest.fn().mockResolvedValue(undefined)

    renderHook(() =>
      useJobStatus({
        jobId: 'job123',
        job: mockJob,
        setJob: mockSetJob,
        rerunningStep: null,
        loadExecutionSteps: mockLoadExecutionSteps,
      })
    )

    // Fast-forward time to trigger polling
    jest.advanceTimersByTime(5000)

    await waitFor(() => {
      expect(api.getJob).toHaveBeenCalled()
    })
  })

  it('should not poll when job is completed', () => {
    const mockJob = { job_id: 'job123', status: 'completed' }

    const mockSetJob = jest.fn()
    const mockLoadExecutionSteps = jest.fn()

    renderHook(() =>
      useJobStatus({
        jobId: 'job123',
        job: mockJob,
        setJob: mockSetJob,
        rerunningStep: null,
        loadExecutionSteps: mockLoadExecutionSteps,
      })
    )

    jest.advanceTimersByTime(5000)

    expect(api.getJob).not.toHaveBeenCalled()
  })

  it('should stop polling when jobId changes', () => {
    const mockJob = { job_id: 'job123', status: 'processing' }

    const mockSetJob = jest.fn()
    const mockLoadExecutionSteps = jest.fn()

    const { rerender } = renderHook(
      ({ jobId }) =>
        useJobStatus({
          jobId,
          job: mockJob,
          setJob: mockSetJob,
          rerunningStep: null,
          loadExecutionSteps: mockLoadExecutionSteps,
        }),
      { initialProps: { jobId: 'job123' } }
    )

    rerender({ jobId: 'job456' })

    jest.advanceTimersByTime(5000)

    // Should not poll for old jobId
    expect(api.getJob).not.toHaveBeenCalled()
  })
})

