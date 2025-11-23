/**
 * @jest-environment jsdom
 * 
 * Unit tests for UserList component.
 */

import { render, screen } from '@testing-library/react'
import { UserList } from '@/features/users/components/users/UserList'
import { User } from '@/features/users/types'

const mockUsers: User[] = [
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

describe('UserList', () => {
  const mockOnEdit = jest.fn()
  const mockOnImpersonate = jest.fn()
  const mockOnCopyCustomerId = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render loading state', () => {
    render(
      <UserList
        users={[]}
        isLoading={true}
        onEdit={mockOnEdit}
        onImpersonate={mockOnImpersonate}
        onCopyCustomerId={mockOnCopyCustomerId}
        copiedCustomerId={null}
        isImpersonating={false}
        impersonatingUserId={null}
      />
    )

    expect(screen.getByText('Loading users...')).toBeInTheDocument()
  })

  it('should render empty state', () => {
    render(
      <UserList
        users={[]}
        isLoading={false}
        onEdit={mockOnEdit}
        onImpersonate={mockOnImpersonate}
        onCopyCustomerId={mockOnCopyCustomerId}
        copiedCustomerId={null}
        isImpersonating={false}
        impersonatingUserId={null}
      />
    )

    expect(screen.getByText('No users found')).toBeInTheDocument()
  })

  it('should render users list', () => {
    render(
      <UserList
        users={mockUsers}
        isLoading={false}
        onEdit={mockOnEdit}
        onImpersonate={mockOnImpersonate}
        onCopyCustomerId={mockOnCopyCustomerId}
        copiedCustomerId={null}
        isImpersonating={false}
        impersonatingUserId={null}
      />
    )

    expect(screen.getByText('User 1')).toBeInTheDocument()
    expect(screen.getByText('User 2')).toBeInTheDocument()
  })
})

