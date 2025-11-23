/**
 * @jest-environment jsdom
 * 
 * Unit tests for useUserActions hooks.
 * 
 * Note: This test requires Jest and React Testing Library to be set up.
 */

import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  useUpdateUserRole,
  useImpersonateUser,
  useCopyCustomerId,
} from '@/features/users/hooks/useUserActions'
import { UsersClient } from '@/features/users/lib/users.client'
import { useAuth } from '@/features/auth/lib/auth/context'
import { toast } from 'react-hot-toast'

jest.mock('@/features/users/lib/users.client')
jest.mock('@/shared/lib/api/token-provider')
jest.mock('next/navigation')
jest.mock('@/features/auth/lib/auth/context')
jest.mock('react-hot-toast')

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

describe('useUpdateUserRole', () => {
  let mockUpdateUserRole: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockUpdateUserRole = jest.fn()
    ;(UsersClient as jest.Mock).mockImplementation(() => ({
      updateUserRole: mockUpdateUserRole,
    }))
  })

  it('should update user role successfully', async () => {
    mockUpdateUserRole.mockResolvedValue(undefined)

    const { result } = renderHook(() => useUpdateUserRole(), {
      wrapper: createWrapper(),
    })

    const user = { user_id: '1', email: 'user@example.com', role: 'USER' }

    await act(async () => {
      await result.current.updateRole(user, 'ADMIN')
    })

    expect(mockUpdateUserRole).toHaveBeenCalledWith('1', { role: 'ADMIN' })
    expect(result.current.isUpdating).toBe(false)
  })

  it('should handle error when updating role', async () => {
    const error = new Error('Update failed')
    mockUpdateUserRole.mockRejectedValue(error)

    const { result } = renderHook(() => useUpdateUserRole(), {
      wrapper: createWrapper(),
    })

    const user = { user_id: '1', email: 'user@example.com', role: 'USER' }

    await act(async () => {
      try {
        await result.current.updateRole(user, 'ADMIN')
      } catch (e) {
        // Expected to fail
      }
    })

    expect(result.current.error).toBe('Update failed')
  })
})

describe('useImpersonateUser', () => {
  let mockImpersonateUser: jest.Mock
  let mockRouter: { push: jest.Mock }
  let mockRefreshAuth: jest.Mock
  let mockSetViewMode: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockImpersonateUser = jest.fn()
    mockRouter = { push: jest.fn() }
    mockRefreshAuth = jest.fn()
    mockSetViewMode = jest.fn()

    ;(UsersClient as jest.Mock).mockImplementation(() => ({
      impersonateUser: mockImpersonateUser,
    }))
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(useAuth as jest.Mock).mockReturnValue({
      refreshAuth: mockRefreshAuth,
      setViewMode: mockSetViewMode,
    })
  })

  it('should impersonate user successfully', async () => {
    mockImpersonateUser.mockResolvedValue({ session_id: 'session123' })
    mockRefreshAuth.mockResolvedValue(undefined)

    const { result } = renderHook(() => useImpersonateUser(), {
      wrapper: createWrapper(),
    })

    const user = {
      user_id: '1',
      email: 'user@example.com',
      customer_id: 'customer123',
    }

    await act(async () => {
      await result.current.impersonate(user)
    })

    expect(mockImpersonateUser).toHaveBeenCalledWith({
      targetUserId: '1',
    })
    expect(localStorage.getItem('impersonation_session_id')).toBe('session123')
    expect(mockRefreshAuth).toHaveBeenCalled()
    expect(mockSetViewMode).toHaveBeenCalledWith('subaccount', 'customer123')
    expect(mockRouter.push).toHaveBeenCalledWith('/dashboard')
  })

  it('should handle impersonation error', async () => {
    const error = new Error('Impersonation failed')
    mockImpersonateUser.mockRejectedValue(error)

    const { result } = renderHook(() => useImpersonateUser(), {
      wrapper: createWrapper(),
    })

    const user = { user_id: '1', email: 'user@example.com' }

    await act(async () => {
      try {
        await result.current.impersonate(user)
      } catch (e) {
        // Expected to fail
      }
    })

    expect(result.current.error).toBe('Impersonation failed')
  })
})

describe('useCopyCustomerId', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('should copy customer ID to clipboard', async () => {
    const { result } = renderHook(() => useCopyCustomerId())

    await act(async () => {
      await result.current.copyCustomerId('customer123')
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('customer123')
    expect(result.current.copiedCustomerId).toBe('customer123')
  })

  it('should clear copiedCustomerId after timeout', async () => {
    jest.useFakeTimers()
    const { result } = renderHook(() => useCopyCustomerId())

    await act(async () => {
      await result.current.copyCustomerId('customer123')
    })

    expect(result.current.copiedCustomerId).toBe('customer123')

    act(() => {
      jest.advanceTimersByTime(2000)
    })

    expect(result.current.copiedCustomerId).toBeNull()
    jest.useRealTimers()
  })

  it('should handle clipboard error', async () => {
    const error = new Error('Clipboard error')
    ;(navigator.clipboard.writeText as jest.Mock).mockRejectedValue(error)

    const { result } = renderHook(() => useCopyCustomerId())

    await act(async () => {
      await result.current.copyCustomerId('customer123')
    })

    expect(toast.error).toHaveBeenCalledWith('Failed to copy customer ID')
  })
})

