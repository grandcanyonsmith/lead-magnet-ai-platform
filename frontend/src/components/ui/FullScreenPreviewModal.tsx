'use client'

import { useEffect, useCallback, useState } from 'react'
import React from 'react'
import { FiX, FiMonitor, FiTablet, FiSmartphone } from 'react-icons/fi'
import { PreviewRenderer } from '@/components/artifacts/PreviewRenderer'

interface FullScreenPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  contentType?: string
  objectUrl?: string
  fileName?: string
  artifactId?: string
}

type ViewMode = 'desktop' | 'tablet' | 'mobile'

export const FullScreenPreviewModal = React.memo(function FullScreenPreviewModal({
  isOpen,
  onClose,
  contentType,
  objectUrl,
  fileName,
  artifactId,
}: FullScreenPreviewModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('desktop')
  
  // Reset view mode when modal opens
  useEffect(() => {
    if (isOpen) {
      setViewMode('desktop')
    }
  }, [isOpen])

  // Handle ESC key to close modal
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      onClose()
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      // Always restore body overflow in cleanup, even if isOpen is false
      if (isOpen) {
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen, handleEscape])

  if (!isOpen) return null

  const isHtml = contentType === 'text/html' || contentType === 'application/xhtml+xml'
  const isMarkdown = contentType === 'text/markdown'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={fileName ? `Preview: ${fileName}` : 'Full screen preview'}
    >
      {/* Preview container */}
      <div
        className={`relative w-[95vw] h-[95vh] bg-black rounded-lg shadow-2xl m-4 flex flex-col ${
          isMarkdown 
            ? 'overflow-hidden' 
            : isHtml 
            ? 'overflow-hidden' 
            : 'overflow-hidden'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with file name and close button */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-gray-900/80 backdrop-blur-sm border-b border-gray-700/50 rounded-t-lg shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {fileName && (
              <h2 className="text-sm sm:text-base font-semibold text-white truncate">
                {fileName}
              </h2>
            )}
            {!fileName && (
              <h2 className="text-sm sm:text-base font-semibold text-white/70">
                Preview
              </h2>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 sm:p-2.5 bg-white/20 hover:bg-white/30 active:bg-white/40 text-white rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50 shadow-lg border border-white/20 shrink-0"
            aria-label="Close preview"
          >
            <FiX className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
          </button>
        </div>

        {/* Content area */}
        <div className={`flex-1 min-h-0 ${
          isMarkdown 
            ? 'overflow-auto' 
            : isHtml 
            ? 'overflow-hidden' 
            : 'overflow-hidden flex items-center justify-center'
        }`}>
          <div className={`w-full ${isHtml ? 'h-full' : ''}`}>
            <PreviewRenderer
              contentType={contentType}
              objectUrl={objectUrl}
              fileName={fileName}
              className={isHtml ? "w-full h-full" : "max-w-full max-h-full w-auto h-auto"}
              artifactId={artifactId}
              isFullScreen={true}
              viewMode={isHtml ? viewMode : undefined}
              onViewModeChange={isHtml ? setViewMode : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  )
})
