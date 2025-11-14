/**
 * Artifact Preview Component
 * Displays artifact preview with loading and error states
 */

'use client'

import { useState, useEffect } from 'react'
import { FiLoader, FiExternalLink } from 'react-icons/fi'
import { api } from '@/lib/api'
import { PreviewRenderer } from '@/components/artifacts/PreviewRenderer'
import { Artifact } from '@/types/artifact'
import { ApiError } from '@/lib/api/errors'
import { getErrorMessage } from '@/utils/api-helpers'

interface ArtifactPreviewProps {
  artifactId: string
}

export function ArtifactPreview({ artifactId }: ArtifactPreviewProps) {
  const [artifact, setArtifact] = useState<Artifact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchArtifact = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await api.getArtifact(artifactId)
        setArtifact(data)
      } catch (err) {
        console.error('Failed to fetch artifact:', err)
        setError(getErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }

    if (artifactId) {
      fetchArtifact()
    }
  }, [artifactId])

  if (loading) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-200 px-4 md:px-0">
        <div className="flex items-center gap-2 text-sm md:text-xs text-gray-500">
          <FiLoader className="w-4 h-4 md:w-3 md:h-3 animate-spin" />
          <span>Loading artifact...</span>
        </div>
      </div>
    )
  }

  if (error || !artifact) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-200 px-4 md:px-0">
        <div className="text-sm md:text-xs text-gray-500">
          <span className="font-mono break-all">Artifact ID: {artifactId}</span>
          {error && <span className="block text-red-600 mt-2 md:mt-1">{error}</span>}
        </div>
      </div>
    )
  }

  const artifactUrl = artifact.object_url || artifact.public_url
  const fileName = artifact.file_name || artifact.artifact_name || artifactId

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 px-4 md:px-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-gray-700 flex-shrink-0">Artifact:</span>
        <span className="text-xs text-gray-600 font-mono truncate" title={fileName}>
          {fileName}
        </span>
      </div>
      
      {artifactUrl && (
        <div className="mt-3 md:mt-2 border-2 border-gray-200 rounded-xl overflow-hidden">
          <div className="aspect-video bg-gray-100">
            <PreviewRenderer
              contentType={artifact.content_type}
              objectUrl={artifactUrl}
              fileName={fileName}
              className="w-full h-full"
              artifactId={artifactId}
            />
          </div>
        </div>
      )}
    </div>
  )
}

