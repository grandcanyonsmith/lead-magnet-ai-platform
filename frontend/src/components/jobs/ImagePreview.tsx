/**
 * Image Preview Component
 * Displays generated images with preview open by default
 */

'use client'

import { useState } from 'react'
import { FiExternalLink } from 'react-icons/fi'
import { PreviewRenderer } from '@/components/artifacts/PreviewRenderer'
import { Artifact } from '@/types/artifact'

interface ImagePreviewProps {
  imageUrl?: string
  artifact?: Artifact
  imageIndex?: number
}

// Helper to truncate long URLs for display
function truncateUrl(url: string, maxLength: number = 50): string {
  if (url.length <= maxLength) {
    return url
  }
  return url.substring(0, maxLength) + '...'
}

// Helper to determine if a file is an image based on extension or content type
function isImageFile(fileName: string, contentType?: string): boolean {
  // Check content type first
  if (contentType) {
    const imageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml']
    if (imageTypes.some(type => contentType.toLowerCase().includes(type))) {
      return true
    }
  }
  
  // Check file extension
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
  const lowerFileName = fileName.toLowerCase()
  return imageExtensions.some(ext => lowerFileName.endsWith(ext))
}

// Helper to get appropriate label based on file type
function getFileLabel(fileName: string, contentType?: string): string {
  if (isImageFile(fileName, contentType)) {
    return 'Generated Image:'
  }
  return 'Generated File:'
}

export function ImagePreview({ imageUrl, artifact, imageIndex = 0 }: ImagePreviewProps) {
  const [showPreview, setShowPreview] = useState(true)

  // Determine the URL and display name
  const url = imageUrl || artifact?.object_url || artifact?.public_url
  const displayName = artifact?.file_name || artifact?.artifact_name || imageUrl || `Image ${imageIndex + 1}`
  const contentType = artifact?.content_type || 'image/png'
  const artifactId = artifact?.artifact_id
  
  // Determine the appropriate label
  const fileLabel = getFileLabel(displayName, contentType)

  if (!url) {
    return null
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 px-4 md:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm font-semibold text-gray-700 flex-shrink-0">{fileLabel}</span>
          <span className="text-xs text-gray-600 font-mono truncate" title={displayName}>
            {displayName}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="text-xs md:text-xs text-blue-600 hover:text-blue-800 active:text-blue-900 flex items-center gap-1 px-3 py-2 md:px-2 md:py-1 rounded-lg hover:bg-blue-50 active:bg-blue-100 transition-colors touch-target min-h-[44px] md:min-h-0 whitespace-nowrap"
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs md:text-xs text-blue-600 hover:text-blue-800 active:text-blue-900 flex items-center gap-1 px-3 py-2 md:px-2 md:py-1 rounded-lg hover:bg-blue-50 active:bg-blue-100 transition-colors touch-target min-h-[44px] md:min-h-0 whitespace-nowrap"
            title={url}
          >
            <FiExternalLink className="w-4 h-4 md:w-3 md:h-3" />
            View
          </a>
        </div>
      </div>
      
      {showPreview && url && (
        <div className="mt-3 md:mt-2 border-2 border-gray-200 rounded-xl overflow-hidden">
          <div className="aspect-video bg-gray-100">
            <PreviewRenderer
              contentType={contentType}
              objectUrl={url}
              fileName={displayName}
              className="w-full h-full"
              artifactId={artifactId}
            />
          </div>
        </div>
      )}
    </div>
  )
}

