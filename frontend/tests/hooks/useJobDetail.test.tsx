/**
 * @jest-environment jsdom
 * 
 * Integration tests for useJobDetail hook (composed hook).
 */

import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useJobDetail } from '@/features/jobs/hooks/useJobDetail'
import { useJobId } from '@/features/jobs/hooks/useJobId'
import { useJobData } from '@/features/jobs/hooks/useJobData'
import { useJobStatus } from '@/features/jobs/hooks/useJobStatus'
import { useJobActions } from '@/features/jobs/hooks/useJobActions'

jest.mock('@/features/jobs/hooks/useJobId')
jest.mock('@/features/jobs/hooks/useJobData')
jest.mock('@/features/jobs/hooks/useJobStatus')
jest.mock('@/features/jobs/hooks/useJobActions')

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useJobDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should compose all hooks correctly', () => {
    const mockJobId = { jobId: 'job123' }
    const mockJobData = {
      job: { job_id: 'job123' },
      workflow: { workflow_id: 'wf123' },
      submission: { submission_id: 'sub123' },
      form: { form_id: 'form123' },
      loading: false,
      error: null,
      setError: jest.fn(),
      executionStepsError: null,
      loadJob: jest.fn(),
      loadExecutionSteps: jest.fn(),
      setJob: jest.fn(),
    }
    const mockJobActions = {
      resubmitting: false,
      handleResubmit: jest.fn(),
      rerunningStep: null,
      handleRerunStep: jest.fn(),
    }

    ;(useJobId as jest.Mock).mockReturnValue(mockJobId)
    ;(useJobData as jest.Mock).mockReturnValue(mockJobData)
    ;(useJobStatus as jest.Mock).mockReturnValue(undefined)
    ;(useJobActions as jest.Mock).mockReturnValue(mockJobActions)

    const { result } = renderHook(() => useJobDetail(), {
      wrapper: createWrapper(),
    })

    expect(result.current.jobId).toBe('job123')
    expect(result.current.job).toEqual({ job_id: 'job123' })
    expect(result.current.workflow).toEqual({ workflow_id: 'wf123' })
    expect(result.current.submission).toEqual({ submission_id: 'sub123' })
    expect(result.current.form).toEqual({ form_id: 'form123' })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.resubmitting).toBe(false)
    expect(typeof result.current.handleResubmit).toBe('function')
    expect(typeof result.current.handleRerunStep).toBe('function')
  })

  it('should pass correct props to composed hooks', () => {
    const mockJobId = { jobId: 'job123' }
    const mockSetJob = jest.fn()
    const mockSetError = jest.fn()
    const mockLoadJob = jest.fn()
    const mockLoadExecutionSteps = jest.fn()

    ;(useJobId as jest.Mock).mockReturnValue(mockJobId)
    ;(useJobData as jest.Mock).mockReturnValue({
      job: { job_id: 'job123' },
      setJob: mockSetJob,
      setError: mockSetError,
      loadJob: mockLoadJob,
      loadExecutionSteps: mockLoadExecutionSteps,
      workflow: null,
      submission: null,
      form: null,
      loading: false,
      error: null,
      executionStepsError: null,
    })
    ;(useJobStatus as jest.Mock).mockReturnValue(undefined)
    ;(useJobActions as jest.Mock).mockReturnValue({
      resubmitting: false,
      handleResubmit: jest.fn(),
      rerunningStep: null,
      handleRerunStep: jest.fn(),
    })

    renderHook(() => useJobDetail(), {
      wrapper: createWrapper(),
    })

    expect(useJobData).toHaveBeenCalledWith({
      jobId: 'job123',
      onJobIdChange: expect.any(Function),
    })

    expect(useJobActions).toHaveBeenCalledWith({
      jobId: 'job123',
      job: { job_id: 'job123' },
      setJob: mockSetJob,
      setError: mockSetError,
      loadJob: mockLoadJob,
    })

    expect(useJobStatus).toHaveBeenCalledWith({
      jobId: 'job123',
      job: { job_id: 'job123' },
      setJob: mockSetJob,
      rerunningStep: null,
      loadExecutionSteps: mockLoadExecutionSteps,
    })
  })
})

