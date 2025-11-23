/**
 * @jest-environment jsdom
 * 
 * Integration tests for users page.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AgencyUsersPage from '@/app/dashboard/agency/users/page'
import { useAuth } from '@/features/auth/lib/auth/context'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useUpdateUserRole, useImpersonateUser, useCopyCustomerId } from '@/features/users/hooks/useUserActions'

jest.mock('@/features/auth/lib/auth/context')
jest.mock('@/features/users/hooks/useUsers')
jest.mock('@/features/users/hooks/useUserActions')

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

describe('AgencyUsersPage', () => {
  const mockUsers = [
    {
      user_id: '1',
      email: 'user1@example.com',
      name: 'User 1',
      role: 'USER',
    },
    {
      user_id: '2',
      email: 'user2@example.com',
      name: 'User 2',
      role: 'ADMIN',
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useAuth as jest.Mock).mockReturnValue({
      role: 'SUPER_ADMIN',
      viewMode: 'agency',
    })
    ;(useUsers as jest.Mock).mockReturnValue({
      users: mockUsers,
      loading: false,
      error: null,
      refetch: jest.fn(),
    })
    ;(useUpdateUserRole as jest.Mock).mockReturnValue({
      updateRole: jest.fn(),
      isUpdating: false,
    })
    ;(useImpersonateUser as jest.Mock).mockReturnValue({
      impersonate: jest.fn(),
      isImpersonating: false,
      impersonatingUserId: null,
    })
    ;(useCopyCustomerId as jest.Mock).mockReturnValue({
      copyCustomerId: jest.fn(),
      copiedCustomerId: null,
    })
  })

  it('should render users page for SUPER_ADMIN', () => {
    render(<AgencyUsersPage />, { wrapper: createWrapper() })

    expect(screen.getByText('User Management')).toBeInTheDocument()
    expect(screen.getByText('User 1')).toBeInTheDocument()
    expect(screen.getByText('User 2')).toBeInTheDocument()
  })

  it('should show access denied for non-SUPER_ADMIN', () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      role: 'ADMIN',
      viewMode: 'agency',
    })

    render(<AgencyUsersPage />, { wrapper: createWrapper() })

    expect(
      screen.getByText(/This page is only available to Super Admins/)
    ).toBeInTheDocument()
  })

  it('should handle search', async () => {
    const user = userEvent.setup()
    const mockOnSearchChange = jest.fn()
    ;(useUsers as jest.Mock).mockReturnValue({
      users: mockUsers,
      loading: false,
      error: null,
      refetch: jest.fn(),
    })

    render(<AgencyUsersPage />, { wrapper: createWrapper() })

    const searchInput = screen.getByPlaceholderText(/Search by name or email/)
    await user.type(searchInput, 'test')

    // Search functionality is handled by useUsers hook
    expect(searchInput).toHaveValue('test')
  })
})

