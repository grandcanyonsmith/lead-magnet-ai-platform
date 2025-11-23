'use client'

import { FiSearch } from 'react-icons/fi'

interface UserSearchBarProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  placeholder?: string
}

export function UserSearchBar({ searchTerm, onSearchChange, placeholder = 'Search by name or email...' }: UserSearchBarProps) {
  return (
    <div className="mb-4 sm:mb-6">
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" />
        <input
          type="text"
          placeholder={placeholder}
          className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-2 text-base sm:text-sm border border-white/60 rounded-2xl bg-white/90 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 shadow-soft outline-none transition-colors"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
    </div>
  )
}

