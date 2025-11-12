import { useState, useEffect, useRef } from 'react'
import { FiFile, FiImage, FiFileText, FiCode } from 'react-icons/fi'

interface PreviewRendererProps {
  contentType?: string
  objectUrl?: string
  fileName?: string
  className?: string
}

export function PreviewRenderer({ contentType, objectUrl, fileName, className = '' }: PreviewRendererProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
        }
      },
      { threshold: 0.1 }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [])

  if (!objectUrl || !contentType) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <FiFile className="w-12 h-12 text-gray-400" />
      </div>
    )
  }

  const renderPreview = () => {
    if (contentType.startsWith('image/')) {
      return (
        <div className="relative w-full h-full">
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <FiImage className="w-12 h-12 text-gray-400 animate-pulse" />
            </div>
          )}
          {imageError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <FiImage className="w-12 h-12 text-gray-400" />
            </div>
          )}
          {isInView && (
            <img
              src={objectUrl}
              alt={fileName || 'Preview'}
              className={`w-full h-full object-cover ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              loading="lazy"
            />
          )}
        </div>
      )
    }

    if (contentType === 'application/pdf') {
      return (
        <div className="relative w-full h-full bg-white">
          {isInView ? (
            <iframe
              src={`${objectUrl}#toolbar=0&navpanes=0&scrollbar=0`}
              className="w-full h-full border-0"
              title={fileName || 'PDF Preview'}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-100">
              <FiFileText className="w-12 h-12 text-red-400" />
            </div>
          )}
        </div>
      )
    }

    if (contentType === 'text/html' || contentType === 'application/xhtml+xml') {
      return (
        <div className="relative w-full h-full bg-white">
          {isInView ? (
            <iframe
              src={objectUrl}
              className="w-full h-full border-0"
              title={fileName || 'HTML Preview'}
              sandbox="allow-same-origin"
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-100">
              <FiCode className="w-12 h-12 text-blue-400" />
            </div>
          )}
        </div>
      )
    }

    if (contentType.startsWith('text/')) {
      return (
        <div className="flex items-center justify-center bg-gray-50 h-full">
          <div className="text-center">
            <FiFileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Text File</p>
          </div>
        </div>
      )
    }

    const icon = contentType.startsWith('video/') ? FiFile :
                 contentType.startsWith('audio/') ? FiFile :
                 FiFile

    return (
      <div className="flex items-center justify-center bg-gray-100 h-full">
        {icon === FiFile ? <FiFile className="w-12 h-12 text-gray-400" /> : null}
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`overflow-hidden ${className}`}>
      {renderPreview()}
    </div>
  )
}
