import { useState, useEffect, useRef } from 'react'
import { FiFile, FiImage, FiFileText, FiCode } from 'react-icons/fi'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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
  const [markdownContent, setMarkdownContent] = useState<string | null>(null)
  const [markdownError, setMarkdownError] = useState(false)
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

  // Fetch markdown content when in view
  useEffect(() => {
    // Reset error state when objectUrl changes (switching to different artifact)
    if (objectUrl) {
      setMarkdownError(false)
      setMarkdownContent(null)
    }
  }, [objectUrl])

  useEffect(() => {
    if (isInView && contentType === 'text/markdown' && objectUrl && !markdownContent && !markdownError) {
      fetch(objectUrl)
        .then(res => res.text())
        .then(text => setMarkdownContent(text))
        .catch(err => {
          console.error('Failed to fetch markdown:', err)
          setMarkdownError(true)
        })
    }
  }, [isInView, contentType, objectUrl, markdownContent, markdownError])

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

    if (contentType === 'text/markdown') {
      return (
        <div className="relative w-full h-full bg-white overflow-auto">
          {isInView ? (
            markdownError ? (
              <div className="flex items-center justify-center h-full bg-gray-50">
                <div className="text-center">
                  <FiFileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Failed to load markdown</p>
                </div>
              </div>
            ) : markdownContent ? (
              <div className="p-4 prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {markdownContent}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full bg-gray-50">
                <div className="text-center">
                  <FiFileText className="w-12 h-12 text-gray-400 mx-auto mb-2 animate-pulse" />
                  <p className="text-xs text-gray-500">Loading markdown...</p>
                </div>
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-50">
              <div className="text-center">
                <FiFileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-xs text-gray-500">Markdown File</p>
              </div>
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
