/**
 * Inline Image Component
 * Renders an image inline with error handling and loading states
 */

import { useState } from 'react'
import { FiImage, FiAlertCircle } from 'react-icons/fi'

interface InlineImageProps {
  url: string
  alt?: string
  className?: string
}

export function InlineImage({ url, alt, className = '' }: InlineImageProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const handleLoad = () => {
    setLoading(false)
    setError(false)
  }

  const handleError = () => {
    setLoading(false)
    setError(true)
  }

  if (error) {
    return (
      <div className={`my-2 p-3 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 text-sm text-red-700">
          <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Failed to load image</span>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block text-xs text-blue-600 hover:text-blue-800 hover:underline break-all"
        >
          {url}
        </a>
      </div>
    )
  }

  return (
    <div className={`my-2 inline-block ${className}`}>
      {loading && (
        <div className="flex items-center justify-center p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FiImage className="w-4 h-4 animate-pulse" />
            <span>Loading image...</span>
          </div>
        </div>
      )}
      <img
        src={url}
        alt={alt || 'Inline image'}
        onLoad={handleLoad}
        onError={handleError}
        className={`max-w-full h-auto rounded-lg border border-gray-200 ${
          loading ? 'hidden' : 'block'
        }`}
        style={{
          maxHeight: '400px',
          objectFit: 'contain',
        }}
        loading="lazy"
      />
      {!loading && !error && (
        <div className="mt-1">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline break-all"
          >
            {url}
          </a>
        </div>
      )}
    </div>
  )
}

