'use client'

import { useEffect, useState, useMemo } from 'react'
import { api } from '@/shared/lib/api'
import { FiRefreshCw, FiInbox } from 'react-icons/fi'
import { PreviewCard } from '@/features/artifacts/components/artifacts/PreviewCard'
import { FiltersBar } from '@/features/artifacts/components/artifacts/FiltersBar'
import { PaginationControls } from '@/features/artifacts/components/artifacts/PaginationControls'

type Artifact = {
  artifact_id: string
  job_id?: string
  workflow_id?: string
  artifact_type?: string
  file_name?: string
  artifact_name?: string
  content_type?: string
  size_bytes?: number
  file_size_bytes?: number
  s3_bucket?: string
  s3_key?: string
  object_url?: string
  public_url?: string
  created_at?: string
}

const ITEMS_PER_PAGE = 12

export default function ArtifactsPage() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    loadArtifacts()
  }, [])

  const loadArtifacts = async () => {
    try {
      const data = await api.getArtifacts({ limit: 500 })
      const artifactsList = data.artifacts || []
      
      // Don't sort here - sorting will be done in filteredArtifacts useMemo
      // to group by workflow/job, then by created_at
      setArtifacts(artifactsList)
    } catch (error) {
      console.error('Failed to load artifacts:', error)
    } finally {
      setLoading(false)
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    try {
      await loadArtifacts()
    } finally {
      setRefreshing(false)
    }
  }

  const artifactTypes = useMemo(() => {
    const types = new Set<string>()
    artifacts.forEach(a => {
      if (a.artifact_type) types.add(a.artifact_type)
    })
    return Array.from(types).sort()
  }, [artifacts])

  const filteredArtifacts = useMemo(() => {
    const filtered = artifacts.filter(artifact => {
      const matchesSearch = !searchQuery || 
        (artifact.file_name || artifact.artifact_name || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        artifact.artifact_id.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesType = !selectedType || artifact.artifact_type === selectedType
      
      return matchesSearch && matchesType
    })
    
    // Sort by created_at DESC (most recent first), then by workflow_id/job_id as secondary sort
    filtered.sort((a: Artifact, b: Artifact) => {
      // Primary sort: created_at DESC (most recent first)
      const dateA = new Date(a.created_at || 0).getTime()
      const dateB = new Date(b.created_at || 0).getTime()
      
      if (dateB !== dateA) {
        return dateB - dateA
      }
      
      // Secondary sort: by workflow_id/job_id for consistency when dates are the same
      const groupA = a.workflow_id || a.job_id || `no-group-${a.artifact_id}`
      const groupB = b.workflow_id || b.job_id || `no-group-${b.artifact_id}`
      return groupA.localeCompare(groupB)
    })
    
    return filtered
  }, [artifacts, searchQuery, selectedType])

  const totalPages = Math.ceil(filteredArtifacts.length / ITEMS_PER_PAGE)
  
  const paginatedArtifacts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return filteredArtifacts.slice(startIndex, endIndex)
  }, [filteredArtifacts, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedType])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4"></div>
          <p className="text-ink-600">Loading downloads...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ink-900">Downloads</h1>
          <p className="text-ink-600 mt-1">
            {filteredArtifacts.length} {filteredArtifacts.length === 1 ? 'file' : 'files'} available
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center px-4 py-2.5 bg-white border border-white/60 rounded-2xl text-ink-600 hover:bg-white/90 transition-all shadow-soft disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiRefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {artifacts.length > 0 && (
        <FiltersBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          artifactTypes={artifactTypes}
        />
      )}

      {filteredArtifacts.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-soft border border-white/60 p-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/80 rounded-full mb-4">
            <FiInbox className="w-8 h-8 text-ink-400" />
          </div>
          <h3 className="text-lg font-semibold text-ink-900 mb-2">
            {artifacts.length === 0 ? 'No downloads yet' : 'No matching files'}
          </h3>
          <p className="text-ink-600">
            {artifacts.length === 0 
              ? 'Generated files will appear here after you run workflows' 
              : 'Try adjusting your search or filter criteria'}
          </p>
          {(searchQuery || selectedType) && (
            <button
              onClick={() => {
                setSearchQuery('')
                setSelectedType('')
              }}
              className="mt-4 text-brand-600 hover:text-brand-700 font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {paginatedArtifacts.map((artifact) => (
              <PreviewCard key={artifact.artifact_id} artifact={artifact} />
            ))}
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredArtifacts.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </div>
  )
}
