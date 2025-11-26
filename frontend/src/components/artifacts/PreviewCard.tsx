'use client'

import { useState } from 'react'
import { PreviewRenderer } from './PreviewRenderer'
import { FullScreenPreviewModal } from '@/components/ui/FullScreenPreviewModal'
import { FiDownload, FiExternalLink, FiClock, FiHardDrive, FiMaximize2 } from 'react-icons/fi'
import { Artifact } from '@/types'

interface PreviewCardProps {
  artifact: Artifact
}

export function PreviewCard({ artifact }: PreviewCardProps) {
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false)
  
  const formatBytes = (bytes?: number) => {
    if (!bytes && bytes !== 0) return '-'
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getFileExtension = (fileName?: string, contentType?: string) => {
    if (fileName && fileName.includes('.')) {
      return fileName.split('.').pop()?.toUpperCase() || 'FILE'
    }
    if (contentType) {
      const type = contentType.split('/')[1]
      return type.toUpperCase()
    }
    return 'FILE'
  }

  const downloadUrl = artifact.object_url || artifact.public_url

  return (
    <div className="group bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-primary-200">
      <div className="relative aspect-video bg-gray-100">
        <PreviewRenderer
          contentType={artifact.content_type || (artifact as any).mime_type}
          objectUrl={downloadUrl}
          fileName={artifact.file_name || artifact.artifact_name}
          className="w-full h-full"
          artifactId={artifact.artifact_id}
        />
        
        <div className="absolute top-2 right-2 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsFullScreenOpen(true)
            }}
            className="p-2 bg-white/90 hover:bg-white text-gray-700 rounded-lg shadow-md transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500 z-10"
            aria-label="Expand preview"
          >
            <FiMaximize2 className="w-4 h-4" />
          </button>
          <div className="bg-primary-600 text-white text-xs font-bold px-2 py-1 rounded">
            {getFileExtension(artifact.file_name || artifact.artifact_name, artifact.content_type || (artifact as any).mime_type)}
          </div>
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-end p-4 gap-2">
          {downloadUrl ? (
            <>
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white text-gray-900 p-2.5 rounded-lg hover:bg-gray-100 transition-colors shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                title="Preview in new tab"
                onClick={(e) => e.stopPropagation()}
              >
                <FiExternalLink className="w-5 h-5" />
              </a>
              <a
                href={downloadUrl}
                download={artifact.file_name || artifact.artifact_name || `download.${artifact.content_type?.split('/')[1]}`}
                className="bg-primary-600 text-white p-2.5 rounded-lg hover:bg-primary-700 transition-colors shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                title="Download"
                onClick={(e) => e.stopPropagation()}
              >
                <FiDownload className="w-5 h-5" />
              </a>
            </>
          ) : (
            <div className="bg-gray-800/80 text-white text-xs px-3 py-2 rounded-lg">
              No URL available
            </div>
          )}
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate mb-2 group-hover:text-primary-600 transition-colors">
          {artifact.file_name || artifact.artifact_name || artifact.artifact_id}
        </h3>

        <div className="space-y-1.5 text-sm text-gray-600">
          {artifact.artifact_type && (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                {artifact.artifact_type}
              </span>
            </div>
          )}

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <FiClock className="w-3.5 h-3.5 text-gray-400" />
              <span>{formatDate(artifact.created_at)}</span>
            </div>
            
            {(artifact.size_bytes || artifact.file_size_bytes) && (
              <div className="flex items-center gap-1">
                <FiHardDrive className="w-3.5 h-3.5 text-gray-400" />
                <span>{formatBytes(artifact.size_bytes || artifact.file_size_bytes)}</span>
              </div>
            )}
          </div>

          {artifact.job_id && (
            <div className="text-xs text-gray-500 font-mono truncate" title={artifact.job_id}>
              Job: {artifact.job_id.substring(0, 12)}...
            </div>
          )}
        </div>
      </div>
      
      <FullScreenPreviewModal
        isOpen={isFullScreenOpen}
        onClose={() => setIsFullScreenOpen(false)}
        contentType={artifact.content_type || (artifact as any).mime_type}
        objectUrl={downloadUrl}
        fileName={artifact.file_name || artifact.artifact_name}
        artifactId={artifact.artifact_id}
      />
    </div>
  )
}
