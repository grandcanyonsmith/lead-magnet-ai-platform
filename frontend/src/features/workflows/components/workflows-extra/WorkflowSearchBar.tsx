'use client'

interface WorkflowSearchBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  workflowsCount: number
}

export function WorkflowSearchBar({ searchQuery, onSearchChange, workflowsCount }: WorkflowSearchBarProps) {
  if (workflowsCount === 0) {
    return null
  }

  return (
    <div className="mb-4 sm:mb-6">
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search lead magnets by name, description, or form..."
          className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <svg
          className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
    </div>
  )
}

