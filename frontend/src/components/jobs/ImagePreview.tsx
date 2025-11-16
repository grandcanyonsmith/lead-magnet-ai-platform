/**
 * Image Preview Component
 * Displays generated images with preview open by default
 */

'use client'

import { FiCpu } from 'react-icons/fi'
import { PreviewRenderer } from '@/components/artifacts/PreviewRenderer'
import { Artifact } from '@/types/artifact'
import { ToolBadgeList } from './ToolBadgeList'

interface ImagePreviewProps {
  imageUrl?: string
  artifact?: Artifact
  imageIndex?: number
  model?: string
  tools?: string[] | unknown[]
  toolChoice?: string
}

export function ImagePreview({ imageUrl, artifact, imageIndex = 0, model, tools, toolChoice }: ImagePreviewProps) {
  // Determine the URL and display name
  const url = imageUrl || artifact?.object_url || artifact?.public_url
  const contentType = artifact?.content_type || 'image/png'
  const artifactId = artifact?.artifact_id

  if (!url) {
    return null
  }

  const hasTools = tools && Array.isArray(tools) && tools.length > 0

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 px-4 md:px-0">
      {(model || hasTools) && (
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {model && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 border border-purple-200">
              <FiCpu className="w-3 h-3" />
              {model}
            </span>
          )}
          {hasTools && (
            <ToolBadgeList
              tools={tools}
              toolChoice={toolChoice && toolChoice !== 'auto' ? toolChoice : undefined}
              showEmptyState={false}
              className="flex flex-wrap gap-1"
              badgeClassName="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 border border-blue-200 whitespace-nowrap"
            />
          )}
        </div>
      )}
      
      {url && (
        <div className="mt-3 md:mt-2 border-2 border-gray-200 rounded-xl overflow-hidden">
          <div className="aspect-video bg-gray-100">
            <PreviewRenderer
              contentType={contentType}
              objectUrl={url}
              fileName={artifact?.file_name || artifact?.artifact_name || imageUrl || `Image ${imageIndex + 1}`}
              className="w-full h-full"
              artifactId={artifactId}
            />
          </div>
        </div>
      )}
    </div>
  )
}

