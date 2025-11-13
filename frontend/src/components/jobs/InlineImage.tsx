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
    <div className={`my-3 md:my-2 w-full ${className}`}>
      {loading && (
        <div className="flex items-center justify-center p-6 md:p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FiImage className="w-5 h-5 md:w-4 md:h-4 animate-pulse" />
            <span>Loading image...</span>
          </div>
        </div>
      )}
      <img
        src={url}
        alt={alt || 'Inline image'}
        onLoad={handleLoad}
        onError={handleError}
        className={`w-full h-auto rounded-lg border border-gray-200 ${
          loading ? 'hidden' : 'block'
        }`}
        style={{
          maxHeight: '500px',
          objectFit: 'contain',
        }}
        loading="lazy"
      />
      {!loading && !error && (
        <div className="mt-2 md:mt-1 px-1">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 active:text-blue-900 hover:underline break-all block touch-target py-1"
          >
            {url}
          </a>
        </div>
      )}
    </div>
  )
}

