/**
 * Image Preview Component
 * Displays generated images with preview open by default
 */

'use client'

import { useState } from 'react'
import { FiCpu, FiMaximize2 } from 'react-icons/fi'
import { PreviewRenderer } from '@/components/artifacts/PreviewRenderer'
import { FullScreenPreviewModal } from '@/components/ui/FullScreenPreviewModal'
import { Artifact } from '@/types/artifact'

interface ImagePreviewProps {
  imageUrl?: string
  artifact?: Artifact
  imageIndex?: number
  model?: string
  tools?: string[] | unknown[]
  toolChoice?: string
}

// Type for tool - can be a string or an object with a type property
type Tool = string | { type: string; [key: string]: unknown }

// Helper to get tool name from tool object or string
function getToolName(tool: Tool): string {
  return typeof tool === 'string' ? tool : (tool.type || 'unknown')
}

export function ImagePreview({ imageUrl, artifact, imageIndex = 0, model, tools, toolChoice }: ImagePreviewProps) {
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false)
  
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
            <>
              {tools.map((tool, toolIdx) => {
                const toolName = getToolName(tool as Tool)
                return (
                  <span
                    key={toolIdx}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 border border-blue-200 whitespace-nowrap"
                  >
                    {toolName}
                  </span>
                )
              })}
              {toolChoice && toolChoice !== 'auto' && (
                <span className="text-xs text-gray-500">({toolChoice})</span>
              )}
            </>
          )}
        </div>
      )}
      
      {url && (
        <div className="mt-3 md:mt-2 border-2 border-gray-200 rounded-xl overflow-hidden relative">
          <button
            onClick={() => setIsFullScreenOpen(true)}
            className="absolute top-2 right-2 z-10 p-2 bg-white/90 hover:bg-white text-gray-700 rounded-lg shadow-md transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Expand preview"
          >
            <FiMaximize2 className="w-4 h-4" />
          </button>
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
      
      <FullScreenPreviewModal
        isOpen={isFullScreenOpen}
        onClose={() => setIsFullScreenOpen(false)}
        contentType={contentType}
        objectUrl={url}
        fileName={artifact?.file_name || artifact?.artifact_name || imageUrl || `Image ${imageIndex + 1}`}
        artifactId={artifactId}
      />
    </div>
  )
}

