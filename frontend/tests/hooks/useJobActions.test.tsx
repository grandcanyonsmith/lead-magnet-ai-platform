/**
 * @jest-environment jsdom
 * 
 * Unit tests for useJobActions hook.
 */

import { renderHook, waitFor } from '@testing-library/react'
import { useJobActions } from '@/features/jobs/hooks/useJobActions'
import { api } from '@/shared/lib/api'
import { toast } from 'react-hot-toast'

jest.mock('@/shared/lib/api')
jest.mock('react-hot-toast')

describe('useJobActions', () => {
  const mockJob = { job_id: 'job123', status: 'completed' }
  const mockSetJob = jest.fn()
  const mockSetError = jest.fn()
  const mockLoadJob = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should resubmit job successfully', async () => {
    const mockResubmittedJob = { job_id: 'job123', status: 'processing' }
    ;(api.resubmitJob as jest.Mock).mockResolvedValue(mockResubmittedJob)

    const { result } = renderHook(() =>
      useJobActions({
        jobId: 'job123',
        job: mockJob,
        setJob: mockSetJob,
        setError: mockSetError,
        loadJob: mockLoadJob,
      })
    )

    await result.current.handleResubmit()

    expect(api.resubmitJob).toHaveBeenCalledWith('job123')
    expect(mockSetJob).toHaveBeenCalledWith(mockResubmittedJob)
    expect(result.current.resubmitting).toBe(false)
  })

  it('should handle resubmit error', async () => {
    const error = new Error('Resubmit failed')
    ;(api.resubmitJob as jest.Mock).mockRejectedValue(error)

    const { result } = renderHook(() =>
      useJobActions({
        jobId: 'job123',
        job: mockJob,
        setJob: mockSetJob,
        setError: mockSetError,
        loadJob: mockLoadJob,
      })
    )

    await result.current.handleResubmit()

    expect(mockSetError).toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
  })

  it('should rerun step successfully', async () => {
    const mockUpdatedJob = { job_id: 'job123', status: 'processing' }
    ;(api.rerunStep as jest.Mock).mockResolvedValue(mockUpdatedJob)

    const { result } = renderHook(() =>
      useJobActions({
        jobId: 'job123',
        job: mockJob,
        setJob: mockSetJob,
        setError: mockSetError,
        loadJob: mockLoadJob,
      })
    )

    await result.current.handleRerunStep(1)

    expect(api.rerunStep).toHaveBeenCalledWith('job123', 1)
    expect(mockSetJob).toHaveBeenCalledWith(mockUpdatedJob)
    expect(result.current.rerunningStep).toBe(null)
  })

  it('should handle rerun step error', async () => {
    const error = new Error('Rerun failed')
    ;(api.rerunStep as jest.Mock).mockRejectedValue(error)

    const { result } = renderHook(() =>
      useJobActions({
        jobId: 'job123',
        job: mockJob,
        setJob: mockSetJob,
        setError: mockSetError,
        loadJob: mockLoadJob,
      })
    )

    await result.current.handleRerunStep(1)

    expect(mockSetError).toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
  })
})

