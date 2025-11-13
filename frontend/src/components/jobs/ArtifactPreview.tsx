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
  const [showPreview, setShowPreview] = useState(false)

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
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <FiLoader className="w-3 h-3 animate-spin" />
          <span>Loading artifact...</span>
        </div>
      </div>
    )
  }

  if (error || !artifact) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          <span className="font-mono break-all">Artifact ID: {artifactId}</span>
          {error && <span className="block text-red-600 mt-1">{error}</span>}
        </div>
      </div>
    )
  }

  const artifactUrl = artifact.object_url || artifact.public_url
  const fileName = artifact.file_name || artifact.artifact_name || artifactId

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Artifact:</span>
          <span className="text-xs text-gray-600 font-mono">{fileName}</span>
        </div>
        <div className="flex items-center gap-2">
          {artifactUrl && (
            <>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
              >
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </button>
              <a
                href={artifactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
              >
                <FiExternalLink className="w-3 h-3" />
                View
              </a>
            </>
          )}
        </div>
      </div>
      
      {showPreview && artifactUrl && (
        <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
          <div className="aspect-video bg-gray-100">
            <PreviewRenderer
              contentType={artifact.content_type || artifact.mime_type}
              objectUrl={artifactUrl}
              fileName={fileName}
              className="w-full h-full"
              artifactId={artifactId}
            />
          </div>
        </div>
      )}
      
      <div className="mt-1 text-xs text-gray-500">
        <span className="font-mono break-all">ID: {artifactId}</span>
        {artifact.size_bytes && (
          <span className="ml-2">
            ({(artifact.size_bytes / 1024).toFixed(1)} KB)
          </span>
        )}
      </div>
    </div>
  )
}

