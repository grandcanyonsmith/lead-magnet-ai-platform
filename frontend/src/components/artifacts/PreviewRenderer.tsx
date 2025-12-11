import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { FiFile, FiImage, FiFileText, FiCode, FiMonitor, FiTablet, FiSmartphone } from 'react-icons/fi'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '@/lib/api'

interface PreviewRendererProps {
  contentType?: string
  objectUrl?: string
  fileName?: string
  className?: string
  artifactId?: string
  isFullScreen?: boolean
  viewMode?: 'desktop' | 'tablet' | 'mobile'
  onViewModeChange?: (mode: 'desktop' | 'tablet' | 'mobile') => void
}

/**
 * Detect content type from file extension as fallback
 */
function detectContentTypeFromExtension(fileName?: string): string | null {
  if (!fileName) return null
  const ext = fileName.split('.').pop()?.toLowerCase()
  const typeMap: Record<string, string> = {
    'html': 'text/html',
    'htm': 'text/html',
    'md': 'text/markdown',
    'markdown': 'text/markdown',
    'txt': 'text/plain',
    'json': 'application/json',
    'pdf': 'application/pdf',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
  }
  return typeMap[ext || ''] || null
}

/**
 * Extract HTML content from markdown code blocks
 * Handles both ```html and ``` markers
 */
function extractHtmlFromCodeBlocks(text: string): string {
  const trimmed = text.trim()
  
  // Check for ```html code block
  if (trimmed.startsWith('```html')) {
    const match = trimmed.match(/^```html\s*([\s\S]*?)\s*```$/i)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  
  // Check for generic ``` code block
  if (trimmed.startsWith('```')) {
    const match = trimmed.match(/^```\s*([\s\S]*?)\s*```$/)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  
  // Return original text if no code blocks found
  return text
}

export function PreviewRenderer({ contentType, objectUrl, fileName, className = '', artifactId, isFullScreen = false, viewMode, onViewModeChange }: PreviewRendererProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [markdownContent, setMarkdownContent] = useState<string | null>(null)
  const [markdownError, setMarkdownError] = useState(false)
  const [htmlContent, setHtmlContent] = useState<string | null>(null)
  const [htmlError, setHtmlError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Determine effective content type with fallback to file extension
  const effectiveContentType = contentType || detectContentTypeFromExtension(fileName) || 'application/octet-stream'

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

  // Reset error state when objectUrl changes (switching to different artifact)
  useEffect(() => {
    if (objectUrl) {
      setMarkdownError(false)
      setMarkdownContent(null)
      setHtmlError(false)
      setHtmlContent(null)
    }
  }, [objectUrl])

  // Fetch markdown content when in view
  useEffect(() => {
    if (isInView && effectiveContentType === 'text/markdown' && !markdownContent && !markdownError) {
      // Use API endpoint if artifactId is available, otherwise fall back to direct URL
      const fetchMarkdown = async () => {
        try {
          let text: string
          if (artifactId) {
            // Use API endpoint to proxy from S3 (avoids presigned URL expiration)
            text = await api.artifacts.getArtifactContent(artifactId)
          } else if (objectUrl) {
            // Fallback to direct URL fetch
            const res = await fetch(objectUrl)
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`)
            }
            text = await res.text()
          } else {
            throw new Error('No artifact ID or URL provided')
          }
          setMarkdownContent(text)
          setMarkdownError(false) // Clear any previous error on success
        } catch (err: any) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Failed to fetch markdown:', err)
          }
          // If artifact not found, show a helpful message instead of error state
          if (err?.message?.includes('404') || err?.message?.includes('not found')) {
            setMarkdownContent('**Artifact file not available**\n\nThe artifact file was not found in storage. It may have been deleted or not yet generated.')
            setMarkdownError(false)
          } else {
            setMarkdownError(true)
          }
        }
      }
      fetchMarkdown()
    }
  }, [isInView, effectiveContentType, objectUrl, artifactId, markdownContent, markdownError])

  // Fetch HTML content when in view
  useEffect(() => {
    if (isInView && (effectiveContentType === 'text/html' || effectiveContentType === 'application/xhtml+xml') && !htmlContent && !htmlError) {
      // Use API endpoint if artifactId is available, otherwise fall back to direct URL
      const fetchHtml = async () => {
        try {
          let text: string
          if (artifactId) {
            // Use API endpoint to proxy from S3 (avoids presigned URL expiration and CORS issues)
            text = await api.artifacts.getArtifactContent(artifactId)
          } else if (objectUrl) {
            // Fallback to direct URL fetch
            const res = await fetch(objectUrl)
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`)
            }
            text = await res.text()
          } else {
            throw new Error('No artifact ID or URL provided')
          }
          // Extract HTML from markdown code blocks if present
          const extractedHtml = extractHtmlFromCodeBlocks(text)
          setHtmlContent(extractedHtml)
          setHtmlError(false) // Clear any previous error on success
        } catch (err: any) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Failed to fetch HTML:', err)
          }
          // If artifact not found, show a helpful message instead of error state
          if (err?.message?.includes('404') || err?.message?.includes('not found')) {
            setHtmlContent('<html><body><h1>Artifact file not available</h1><p>The artifact file was not found in storage. It may have been deleted or not yet generated.</p></body></html>')
            setHtmlError(false)
          } else {
            setHtmlError(true)
          }
        }
      }
      fetchHtml()
    }
  }, [isInView, effectiveContentType, objectUrl, artifactId, htmlContent, htmlError])

  if (!objectUrl && !artifactId) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <FiFile className="w-12 h-12 text-gray-400" />
      </div>
    )
  }

  const renderPreview = () => {
    if (effectiveContentType.startsWith('image/')) {
      if (isFullScreen) {
        // Full-screen mode: use regular img tag for better scaling
        return (
          <div className="relative flex items-center justify-center w-full h-full">
            {!imageLoaded && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <FiImage className="w-12 h-12 text-white/50 animate-pulse" />
              </div>
            )}
            {imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <FiImage className="w-12 h-12 text-white/50" />
              </div>
            )}
            {isInView && objectUrl && (
              <img
                src={objectUrl}
                alt={fileName || 'Preview'}
                className={`max-w-[95vw] max-h-[95vh] object-contain ${imageLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                style={{ maxWidth: '95vw', maxHeight: '95vh' }}
              />
            )}
          </div>
        )
      }
      
      // Regular mode: use Next.js Image with fill
      return (
        <div className="relative w-full h-full flex items-center justify-center min-h-0">
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
          {isInView && objectUrl && (
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <Image
                src={objectUrl}
                alt={fileName || 'Preview'}
                fill
                className={`object-contain ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                unoptimized
                sizes="(max-width: 768px) 100vw, 95vw"
              />
            </div>
          )}
        </div>
      )
    }

    if (effectiveContentType === 'application/pdf') {
      return (
        <div className="relative w-full h-full bg-white">
          {isInView && objectUrl ? (
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

    if (effectiveContentType === 'text/html' || effectiveContentType === 'application/xhtml+xml') {
      if (isFullScreen) {
        // Full-screen HTML rendering with view mode support
        return (
          <div className="relative w-full h-full bg-white flex flex-col">
            {/* Header with view mode switcher */}
            {onViewModeChange && (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-100 border-b border-gray-200">
                <div className="flex gap-2">
                  <button
                    onClick={() => onViewModeChange('desktop')}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === 'desktop'
                        ? 'bg-gray-700 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-200'
                    }`}
                    aria-label="Desktop view"
                    title="Desktop view"
                  >
                    <FiMonitor className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onViewModeChange('tablet')}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === 'tablet'
                        ? 'bg-gray-700 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-200'
                    }`}
                    aria-label="Tablet view"
                    title="Tablet view"
                  >
                    <FiTablet className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onViewModeChange('mobile')}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === 'mobile'
                        ? 'bg-gray-700 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-200'
                    }`}
                    aria-label="Mobile view"
                    title="Mobile view"
                  >
                    <FiSmartphone className="w-5 h-5" />
                  </button>
                </div>
                {fileName && (
                  <div className="text-sm font-medium text-gray-700 truncate max-w-md">
                    {fileName}
                  </div>
                )}
              </div>
            )}
            
            {/* HTML content area */}
            <div className="flex-1 min-h-0">
              {isInView ? (
                htmlError ? (
                  <div className="flex items-center justify-center h-full bg-gray-50">
                    <div className="text-center">
                      <FiCode className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">Failed to load HTML</p>
                    </div>
                  </div>
                ) : htmlContent ? (
                  <div 
                    className={`bg-white transition-all duration-300 h-full ${
                      viewMode === 'tablet' ? 'w-[768px] max-w-[768px] mx-auto' : 
                      viewMode === 'mobile' ? 'w-[375px] max-w-[375px] mx-auto' : 
                      'w-full'
                    }`}
                  >
                    <iframe
                      srcDoc={htmlContent}
                      className="w-full h-full border-0"
                      title={fileName || 'HTML Preview'}
                      sandbox="allow-same-origin allow-scripts allow-forms"
                      referrerPolicy="no-referrer"
                      style={{ display: 'block', height: '100%' }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full bg-black">
                    <div className="text-center">
                      <FiCode className="w-12 h-12 text-white/50 mx-auto mb-2 animate-pulse" />
                      <p className="text-xs text-white/70">Loading HTML...</p>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center h-full bg-black">
                  <FiCode className="w-12 h-12 text-white/50" />
                </div>
              )}
            </div>
          </div>
        )
      }
      
      // Regular HTML rendering
      return (
        <div className="relative w-full h-full bg-white">
          {isInView ? (
            htmlError ? (
              <div className="flex items-center justify-center h-full bg-gray-50">
                <div className="text-center">
                  <FiCode className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Failed to load HTML</p>
                </div>
              </div>
            ) : htmlContent ? (
              <iframe
                srcDoc={htmlContent}
                className="w-full h-full border-0"
                title={fileName || 'HTML Preview'}
                sandbox="allow-same-origin allow-scripts"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex items-center justify-center h-full bg-gray-50">
                <div className="text-center">
                  <FiCode className="w-12 h-12 text-blue-400 mx-auto mb-2 animate-pulse" />
                  <p className="text-xs text-gray-500">Loading HTML...</p>
                </div>
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-100">
              <FiCode className="w-12 h-12 text-blue-400" />
            </div>
          )}
        </div>
      )
    }

    if (effectiveContentType === 'text/markdown') {
      if (isFullScreen) {
        // Full-screen markdown rendering with scrolling
        return (
          <div className="relative w-full bg-white">
            {isInView ? (
              markdownError ? (
                <div className="flex items-center justify-center min-h-[95vh] bg-gray-50">
                  <div className="text-center">
                    <FiFileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">Failed to load markdown</p>
                  </div>
                </div>
              ) : markdownContent ? (
                <div className="p-8 prose prose-lg max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {markdownContent}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="flex items-center justify-center min-h-[95vh] bg-black">
                  <div className="text-center">
                    <FiFileText className="w-12 h-12 text-white/50 mx-auto mb-2 animate-pulse" />
                    <p className="text-xs text-white/70">Loading markdown...</p>
                  </div>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center min-h-[95vh] bg-black">
                <div className="text-center">
                  <FiFileText className="w-12 h-12 text-white/50 mx-auto mb-2" />
                  <p className="text-xs text-white/70">Markdown File</p>
                </div>
              </div>
            )}
          </div>
        )
      }
      
      // Regular markdown rendering
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

    if (effectiveContentType.startsWith('text/')) {
      return (
        <div className="flex items-center justify-center bg-gray-50 h-full">
          <div className="text-center">
            <FiFileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Text File</p>
          </div>
        </div>
      )
    }

    const icon = effectiveContentType.startsWith('video/') ? FiFile :
                 effectiveContentType.startsWith('audio/') ? FiFile :
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
