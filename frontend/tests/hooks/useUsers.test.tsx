/**
 * @jest-environment jsdom
 * 
 * Unit tests for useUsers hook.
 * 
 * Note: This test requires Jest and React Testing Library to be set up.
 * Install dependencies:
 * npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event
 */

import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useUsers } from '@/features/users/hooks/useUsers'
import { UsersClient } from '@/features/users/lib/users.client'

// Mock the users client
jest.mock('@/features/users/lib/users.client')
jest.mock('@/shared/lib/api/token-provider')

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useUsers', () => {
  let mockGetUsers: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUsers = jest.fn()
    ;(UsersClient as jest.Mock).mockImplementation(() => ({
      getUsers: mockGetUsers,
    }))
  })

  it('should fetch users successfully', async () => {
    const mockUsers = [
      { user_id: '1', email: 'user1@example.com', name: 'User 1' },
      { user_id: '2', email: 'user2@example.com', name: 'User 2' },
    ]
    mockGetUsers.mockResolvedValue({ users: mockUsers })

    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    })

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.users).toEqual(mockUsers)
    expect(result.current.error).toBeNull()
  })

  it('should handle loading state', () => {
    mockGetUsers.mockImplementation(() => new Promise(() => {})) // Never resolves

    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    })

    expect(result.current.loading).toBe(true)
    expect(result.current.users).toEqual([])
  })

  it('should handle error state', async () => {
    const errorMessage = 'Failed to fetch users'
    mockGetUsers.mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe(errorMessage)
    expect(result.current.users).toEqual([])
  })

  it('should pass query parameters to getUsers', async () => {
    const params = { q: 'test', limit: 10 }
    mockGetUsers.mockResolvedValue({ users: [] })

    renderHook(() => useUsers(params), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(mockGetUsers).toHaveBeenCalledWith(params)
    })
  })

  it('should support refetch', async () => {
    mockGetUsers.mockResolvedValue({ users: [] })

    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockGetUsers).toHaveBeenCalledTimes(1)

    result.current.refetch()

    await waitFor(() => {
      expect(mockGetUsers).toHaveBeenCalledTimes(2)
    })
  })
})

