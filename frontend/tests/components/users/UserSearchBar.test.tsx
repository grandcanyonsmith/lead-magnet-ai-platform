/**
 * @jest-environment jsdom
 * 
 * Unit tests for UserSearchBar component.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserSearchBar } from '@/features/users/components/users/UserSearchBar'

describe('UserSearchBar', () => {
  it('should render search input', () => {
    const mockOnSearchChange = jest.fn()
    render(
      <UserSearchBar
        searchTerm=""
        onSearchChange={mockOnSearchChange}
      />
    )

    const input = screen.getByPlaceholderText('Search by name or email...')
    expect(input).toBeInTheDocument()
  })

  it('should display search term', () => {
    const mockOnSearchChange = jest.fn()
    render(
      <UserSearchBar
        searchTerm="test query"
        onSearchChange={mockOnSearchChange}
      />
    )

    const input = screen.getByPlaceholderText('Search by name or email...')
    expect(input).toHaveValue('test query')
  })

  it('should call onSearchChange when input changes', async () => {
    const user = userEvent.setup()
    const mockOnSearchChange = jest.fn()
    render(
      <UserSearchBar
        searchTerm=""
        onSearchChange={mockOnSearchChange}
      />
    )

    const input = screen.getByPlaceholderText('Search by name or email...')
    await user.type(input, 'test')

    expect(mockOnSearchChange).toHaveBeenCalledTimes(4) // Once for each character
    expect(mockOnSearchChange).toHaveBeenLastCalledWith('test')
  })

  it('should use custom placeholder', () => {
    const mockOnSearchChange = jest.fn()
    render(
      <UserSearchBar
        searchTerm=""
        onSearchChange={mockOnSearchChange}
        placeholder="Custom placeholder"
      />
    )

    const input = screen.getByPlaceholderText('Custom placeholder')
    expect(input).toBeInTheDocument()
  })
})

