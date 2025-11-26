'use client'

import { useEffect } from 'react'
import { FiX } from 'react-icons/fi'
import { PreviewRenderer } from '@/components/artifacts/PreviewRenderer'

interface FullScreenPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  contentType?: string
  objectUrl?: string
  fileName?: string
  artifactId?: string
}

export function FullScreenPreviewModal({
  isOpen,
  onClose,
  contentType,
  objectUrl,
  fileName,
  artifactId,
}: FullScreenPreviewModalProps) {
  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-label="Close preview"
      >
        <FiX className="w-6 h-6" />
      </button>

      {/* Preview container */}
      <div
        className="relative w-[95vw] h-[95vh] bg-white rounded-lg overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full h-full">
          <PreviewRenderer
            contentType={contentType}
            objectUrl={objectUrl}
            fileName={fileName}
            className="w-full h-full"
            artifactId={artifactId}
          />
        </div>
      </div>
    </div>
  )
}
