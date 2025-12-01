import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { FiFile, FiImage, FiFileText, FiCode } from 'react-icons/fi'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '@/lib/api'

interface PreviewRendererProps {
  contentType?: string
  objectUrl?: string
  fileName?: string
  className?: string
  artifactId?: string
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

export function PreviewRenderer({ contentType, objectUrl, fileName, className = '', artifactId }: PreviewRendererProps) {
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
          console.error('Failed to fetch markdown:', err)
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
          console.error('Failed to fetch HTML:', err)
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
          {isInView && objectUrl && (
            <Image
              src={objectUrl}
              alt={fileName || 'Preview'}
              fill
              className={`object-cover ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              unoptimized
            />
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
