/**
 * @jest-environment jsdom
 * 
 * Unit tests for EditRoleModal component.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditRoleModal } from '@/features/users/components/users/EditRoleModal'
import { User } from '@/features/users/types'

const mockUser: User = {
  user_id: '1',
  email: 'user@example.com',
  name: 'Test User',
  role: 'USER',
}

describe('EditRoleModal', () => {
  const mockOnClose = jest.fn()
  const mockOnSave = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should not render when closed', () => {
    render(
      <EditRoleModal
        isOpen={false}
        user={mockUser}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    )

    expect(screen.queryByText('Edit User Role')).not.toBeInTheDocument()
  })

  it('should render when open', () => {
    render(
      <EditRoleModal
        isOpen={true}
        user={mockUser}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    )

    expect(screen.getByText('Edit User Role')).toBeInTheDocument()
    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('should call onClose when cancel button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <EditRoleModal
        isOpen={true}
        user={mockUser}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    )

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should call onSave when save button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <EditRoleModal
        isOpen={true}
        user={mockUser}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={false}
      />
    )

    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(mockUser, expect.any(String))
    })
  })

  it('should disable save button when saving', () => {
    render(
      <EditRoleModal
        isOpen={true}
        user={mockUser}
        onClose={mockOnClose}
        onSave={mockOnSave}
        isSaving={true}
      />
    )

    const saveButton = screen.getByRole('button', { name: /save/i })
    expect(saveButton).toBeDisabled()
  })
})

