'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { FiSearch, FiX, FiHome, FiList, FiBarChart2, FiFileText, FiSettings, FiCommand } from 'react-icons/fi'
import { api } from '@/shared/lib/api'

interface SearchResult {
  id: string
  type: 'page' | 'workflow' | 'job'
  title: string
  subtitle?: string
  href: string
}

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [workflows, setWorkflows] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Navigation items for quick access
  const navItems: SearchResult[] = [
    { id: 'nav-dashboard', type: 'page', title: 'Dashboard', href: '/dashboard', subtitle: 'Overview' },
    { id: 'nav-workflows', type: 'page', title: 'Lead Magnets', href: '/dashboard/workflows', subtitle: 'Manage workflows' },
    { id: 'nav-jobs', type: 'page', title: 'Generated Lead Magnets', href: '/dashboard/jobs', subtitle: 'View jobs' },
    { id: 'nav-artifacts', type: 'page', title: 'Downloads', href: '/dashboard/artifacts', subtitle: 'Downloaded files' },
    { id: 'nav-settings', type: 'page', title: 'Settings', href: '/dashboard/settings', subtitle: 'Account settings' },
  ]

  // Load workflows and jobs for search
  useEffect(() => {
    if (isOpen) {
      loadSearchData()
    }
  }, [isOpen])

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const loadSearchData = async () => {
    setLoading(true)
    try {
      const [workflowsData, jobsData] = await Promise.all([
        api.getWorkflows().catch(() => ({ workflows: [] })),
        api.getJobs({ limit: 50 }).catch(() => ({ jobs: [] })),
      ])
      setWorkflows(workflowsData.workflows || [])
      setJobs(jobsData.jobs || [])
    } catch (error) {
      console.error('Failed to load search data:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchResults = useMemo(() => {
    if (!query.trim()) {
      return navItems
    }

    const queryLower = query.toLowerCase()
    const results: SearchResult[] = []

    // Search navigation items
    navItems.forEach((item) => {
      if (
        item.title.toLowerCase().includes(queryLower) ||
        item.subtitle?.toLowerCase().includes(queryLower)
      ) {
        results.push(item)
      }
    })

    // Search workflows
    workflows.forEach((workflow) => {
      const name = (workflow.workflow_name || '').toLowerCase()
      const description = (workflow.workflow_description || '').toLowerCase()
      if (name.includes(queryLower) || description.includes(queryLower)) {
        results.push({
          id: `workflow-${workflow.workflow_id}`,
          type: 'workflow',
          title: workflow.workflow_name || 'Unnamed Workflow',
          subtitle: workflow.workflow_description || 'Workflow',
          href: `/dashboard/workflows/${workflow.workflow_id}`,
        })
      }
    })

    // Search jobs
    jobs.forEach((job) => {
      const jobId = (job.job_id || '').toLowerCase()
      const workflowName = (job.workflow_name || '').toLowerCase()
      if (jobId.includes(queryLower) || workflowName.includes(queryLower)) {
        results.push({
          id: `job-${job.job_id}`,
          type: 'job',
          title: job.workflow_name || 'Generated Lead Magnet',
          subtitle: `Job ${job.job_id}`,
          href: `/dashboard/jobs/${job.job_id}`,
        })
      }
    })

    return results.slice(0, 10) // Limit to 10 results
  }, [query, workflows, jobs, navItems])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, searchResults.length - 1))
      scrollToSelected()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
      scrollToSelected()
    } else if (e.key === 'Enter' && searchResults[selectedIndex]) {
      e.preventDefault()
      handleSelect(searchResults[selectedIndex])
    }
  }

  const scrollToSelected = () => {
    if (resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }

  const handleSelect = (result: SearchResult) => {
    router.push(result.href)
    onClose()
    setQuery('')
  }

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'page':
        return <FiHome className="w-4 h-4" />
      case 'workflow':
        return <FiList className="w-4 h-4" />
      case 'job':
        return <FiBarChart2 className="w-4 h-4" />
      default:
        return <FiSearch className="w-4 h-4" />
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-soft border border-white/60">
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-white/60">
          <FiSearch className="w-5 h-5 text-ink-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, workflows, jobs..."
            className="flex-1 text-base outline-none placeholder-ink-400 text-ink-900"
          />
          <div className="flex items-center gap-2">
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-ink-500 bg-surface-50 border border-white/60 rounded-2xl shadow-soft">
              <FiCommand className="w-3 h-3" />K
            </kbd>
            <button
              onClick={onClose}
              className="p-1 text-ink-400 hover:text-ink-700 rounded-2xl hover:bg-surface-50 transition-colors"
              aria-label="Close"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          className="max-h-96 overflow-y-auto"
        >
          {loading ? (
            <div className="p-8 text-center text-ink-500">Loading...</div>
          ) : searchResults.length === 0 ? (
            <div className="p-8 text-center text-ink-500">
              <FiSearch className="w-12 h-12 mx-auto mb-2 text-ink-300" />
              <p>No results found</p>
              <p className="text-sm text-ink-400 mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="py-2">
              {searchResults.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    index === selectedIndex
                      ? 'bg-brand-50 text-brand-700'
                      : 'hover:bg-surface-50 text-ink-900'
                  }`}
                >
                  <div className={`flex-shrink-0 ${index === selectedIndex ? 'text-brand-600' : 'text-ink-400'}`}>
                    {getIcon(result.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{result.title}</div>
                    {result.subtitle && (
                      <div className={`text-sm truncate ${index === selectedIndex ? 'text-brand-600' : 'text-ink-500'}`}>
                        {result.subtitle}
                      </div>
                    )}
                  </div>
                  {result.type === 'workflow' && (
                    <span className="text-xs px-2 py-0.5 bg-surface-50 text-ink-600 rounded-2xl">
                      Workflow
                    </span>
                  )}
                  {result.type === 'job' && (
                    <span className="text-xs px-2 py-0.5 bg-surface-50 text-ink-600 rounded-2xl">
                      Job
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/60 bg-surface-50 flex items-center justify-between text-xs text-ink-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-white/60 rounded-2xl shadow-soft">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-white/60 rounded-2xl shadow-soft">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-white/60 rounded-2xl shadow-soft">Esc</kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
