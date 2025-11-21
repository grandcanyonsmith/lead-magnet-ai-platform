import { FiSearch, FiFilter } from 'react-icons/fi'

interface FiltersBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedType: string
  onTypeChange: (type: string) => void
  artifactTypes: string[]
}

export function FiltersBar({ 
  searchQuery, 
  onSearchChange, 
  selectedType, 
  onTypeChange,
  artifactTypes 
}: FiltersBarProps) {
  return (
    <div className="bg-white rounded-2xl shadow-soft border border-white/60 p-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="h-5 w-5 text-ink-400" />
          </div>
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="block w-full pl-10 pr-3 py-2.5 border border-white/60 rounded-2xl bg-white/90 text-ink-900 placeholder-ink-400 shadow-soft focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>

        <div className="sm:w-64">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiFilter className="h-5 w-5 text-ink-400" />
            </div>
            <select
              value={selectedType}
              onChange={(e) => onTypeChange(e.target.value)}
              className="block w-full pl-10 pr-3 py-2.5 border border-white/60 rounded-2xl bg-white/90 text-ink-900 shadow-soft focus:ring-2 focus:ring-brand-500 focus:border-brand-500 appearance-none cursor-pointer"
            >
              <option value="">All Types</option>
              {artifactTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
