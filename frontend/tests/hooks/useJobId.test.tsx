/**
 * @jest-environment jsdom
 * 
 * Unit tests for useJobId hook.
 */

import { renderHook } from '@testing-library/react'
import { useParams } from 'next/navigation'
import { useJobId } from '@/features/jobs/hooks/useJobId'
import { extractJobId } from '@/features/jobs/utils/jobIdExtraction'

jest.mock('next/navigation')
jest.mock('@/features/jobs/utils/jobIdExtraction')

describe('useJobId', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should extract jobId from params', () => {
    const mockParams = { id: 'job123' }
    ;(useParams as jest.Mock).mockReturnValue(mockParams)
    ;(extractJobId as jest.Mock).mockReturnValue('job123')

    const { result } = renderHook(() => useJobId())

    expect(result.current.jobId).toBe('job123')
    expect(extractJobId).toHaveBeenCalledWith(mockParams)
  })

  it('should update jobId when params change', () => {
    const mockParams1 = { id: 'job123' }
    const mockParams2 = { id: 'job456' }
    
    ;(useParams as jest.Mock).mockReturnValue(mockParams1)
    ;(extractJobId as jest.Mock).mockReturnValue('job123')

    const { result, rerender } = renderHook(() => useJobId())

    expect(result.current.jobId).toBe('job123')

    ;(useParams as jest.Mock).mockReturnValue(mockParams2)
    ;(extractJobId as jest.Mock).mockReturnValue('job456')

    rerender()

    expect(result.current.jobId).toBe('job456')
  })

  it('should handle invalid job IDs', () => {
    const mockParams = { id: '_' }
    ;(useParams as jest.Mock).mockReturnValue(mockParams)
    ;(extractJobId as jest.Mock).mockReturnValue('_')

    const { result } = renderHook(() => useJobId())

    // Should not update if jobId is invalid
    expect(result.current.jobId).toBe('_')
  })
})

