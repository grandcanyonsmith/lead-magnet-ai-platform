'use client'

import React from 'react'
import { FiCpu } from 'react-icons/fi'
import clsx from 'clsx'
import { Artifact } from '@/features/artifacts/types'
import { PreviewRenderer } from '@/features/artifacts/components/artifacts/PreviewRenderer'
import { ToolBadgeList } from '../ToolBadgeList'
import { truncateUrl } from '../step-utils'

export interface ImageGalleryData {
  imageUrls: string[]
  artifacts: Artifact[]
  model?: string
  tools?: unknown[]
  toolChoice?: string
  loading?: boolean
}

interface ImageGalleryProps extends ImageGalleryData {
  title?: string
  className?: string
  showMetadata?: boolean
}

export function ImageGallery({
  imageUrls,
  artifacts,
  model,
  tools,
  toolChoice,
  loading,
  title = 'Generated Images:',
  className,
  showMetadata = true,
}: ImageGalleryProps) {
  const hasImageUrls = imageUrls.length > 0
  const hasArtifacts = artifacts.length > 0

  if (!hasImageUrls && !hasArtifacts && !loading) {
    return null
  }

  return (
    <div className={clsx('mt-3 md:mt-2.5 pt-3 md:pt-2.5 border-t border-gray-200', className)}>
      {showMetadata && (model || (tools && tools.length > 0)) && (
        <div className="flex items-center gap-2 mb-3 md:mb-2 flex-wrap">
          {model && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 border border-purple-200">
              <FiCpu className="w-3 h-3" />
              {model}
            </span>
          )}
          <ToolBadgeList
            tools={tools}
            toolChoice={toolChoice && toolChoice !== 'auto' ? toolChoice : undefined}
            showEmptyState={false}
            className="flex items-center gap-1.5 flex-wrap"
            badgeClassName="bg-blue-100 text-blue-800 border-blue-200"
          />
        </div>
      )}

      <span className="text-sm md:text-xs font-semibold text-gray-700 mb-2.5 md:mb-2 block">
        {title}
      </span>

      {loading && !hasImageUrls && !hasArtifacts && (
        <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
          <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
          <span>Loading images...</span>
        </div>
      )}

      {hasImageUrls && (
        <div className="grid grid-cols-1 gap-2.5 md:gap-2">
          {imageUrls.map((imageUrl, imgIdx) => (
            <div key={`url-${imgIdx}`} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="aspect-video bg-gray-100">
                <PreviewRenderer
                  contentType="image/png"
                  objectUrl={imageUrl}
                  fileName={`Generated image ${imgIdx + 1}`}
                  className="w-full h-full"
                />
              </div>
              <div className="p-3 md:p-2 bg-gray-100">
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm md:text-xs text-blue-600 hover:text-blue-800 active:text-blue-900 break-all block touch-target py-2 md:py-1 min-h-[44px] md:min-h-0"
                  title={imageUrl}
                >
                  {truncateUrl(imageUrl)}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {!hasImageUrls && hasArtifacts && (
        <div className="grid grid-cols-1 gap-2.5 md:gap-2">
          {artifacts.map((artifact, imgIdx) => {
            const artifactUrl = artifact.object_url || artifact.public_url
            if (!artifactUrl) return null

            return (
              <div key={artifact.artifact_id || imgIdx} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="aspect-video bg-gray-100">
                  <PreviewRenderer
                    contentType={artifact.content_type || 'image/png'}
                    objectUrl={artifactUrl}
                    fileName={artifact.file_name || artifact.artifact_name || `Image ${imgIdx + 1}`}
                    className="w-full h-full"
                    artifactId={artifact.artifact_id}
                  />
                </div>
                <div className="p-3 md:p-2 bg-gray-100">
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={artifactUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs md:text-xs text-blue-600 hover:text-blue-800 active:text-blue-900 truncate flex-1 min-w-0"
                      title={artifact.file_name || artifact.artifact_name || artifactUrl}
                    >
                      {artifact.file_name || artifact.artifact_name || truncateUrl(artifactUrl)}
                    </a>
                    {artifact.artifact_id && (
                      <span className="text-xs text-gray-500 font-mono flex-shrink-0">
                        {artifact.artifact_id.substring(0, 12)}...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

