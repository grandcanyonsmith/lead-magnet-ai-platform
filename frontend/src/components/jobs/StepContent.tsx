'use client'

import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'
import { extractImageUrls, extractImageUrlsFromObject } from '@/utils/imageUtils'
import { InlineImage } from './InlineImage'

const MAX_PREVIEW_LENGTH = 1000

interface StepContentProps {
  formatted: { content: any, type: 'json' | 'markdown' | 'text' | 'html', structure?: 'ai_input' }
  imageUrls?: string[] // Optional array of image URLs to render inline
}

/**
 * Render text content with inline images
 * Splits text by image URLs and renders images inline
 */
function renderTextWithImages(text: string): React.ReactNode {
  const imageUrls = extractImageUrls(text)
  
  if (imageUrls.length === 0) {
    return <>{text}</>
  }

  // Split text by image URLs and render images inline
  let remainingText = text
  const parts: React.ReactNode[] = []
  let partIndex = 0

  imageUrls.forEach((url, idx) => {
    const urlIndex = remainingText.indexOf(url)
    if (urlIndex === -1) return

    // Add text before the URL
    if (urlIndex > 0) {
      parts.push(
        <span key={`text-${partIndex++}`}>
          {remainingText.substring(0, urlIndex)}
        </span>
      )
    }

    // Add the image
    parts.push(
      <div key={`image-${idx}`} className="block">
        <InlineImage url={url} alt={`Image ${idx + 1}`} />
      </div>
    )

    // Update remaining text
    remainingText = remainingText.substring(urlIndex + url.length)
  })

  // Add any remaining text
  if (remainingText.length > 0) {
    parts.push(
      <span key={`text-${partIndex}`}>
        {remainingText}
      </span>
    )
  }

  return <>{parts}</>
}

// Inline expandable content component
function ExpandableContent({
  content,
  renderContent,
  maxLength = MAX_PREVIEW_LENGTH
}: {
  content: string
  renderContent: (displayContent: string, isExpanded: boolean) => React.ReactNode
  maxLength?: number
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isLongContent = content.length > maxLength
  const displayContent = isLongContent && !isExpanded
    ? content.substring(0, maxLength) + '...'
    : content

  return (
    <div>
      {isLongContent && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-blue-600 hover:text-blue-800 active:text-blue-900 flex items-center gap-1 px-2 py-1.5 rounded touch-target min-h-[44px] sm:min-h-0"
          >
            {isExpanded ? (
              <>
                <FiChevronUp className="w-3 h-3" />
                <span className="sm:inline">Show Less</span>
              </>
            ) : (
              <>
                <FiChevronDown className="w-3 h-3" />
                <span className="sm:inline">Show More</span>
                <span className="hidden sm:inline"> ({content.length.toLocaleString()} chars)</span>
              </>
            )}
          </button>
        </div>
      )}
      {renderContent(displayContent, isExpanded)}
    </div>
  )
}

export function StepContent({ formatted, imageUrls = [] }: StepContentProps) {
  const [showRendered, setShowRendered] = useState(true)
  
  const getContentString = (): string => {
    if (typeof formatted.content === 'string') {
      return formatted.content
    }
    return JSON.stringify(formatted.content, null, 2)
  }
  
  const contentString = getContentString()
  
  // Render inline images from imageUrls prop
  const renderInlineImages = () => {
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return null
    }
    
    return (
      <div className="mt-5 md:mt-4 space-y-4 md:space-y-2">
        <div className="text-sm md:text-xs font-medium text-gray-600 mb-3 md:mb-2">Generated Images:</div>
        {imageUrls.map((url, idx) => (
          <InlineImage key={`inline-image-${idx}`} url={url} alt={`Image ${idx + 1}`} />
        ))}
      </div>
    )
  }
  
  // Render metadata section for AI input structure
  const renderMetadata = () => {
    if (formatted.structure !== 'ai_input' || typeof formatted.content !== 'object') {
      return null
    }

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-xs font-semibold text-gray-700">Model:</span>
            <span className="text-xs text-gray-900 ml-2 font-mono">{formatted.content.model}</span>
          </div>
          {formatted.content.tool_choice && (
            <div>
              <span className="text-xs font-semibold text-gray-700">Tool Choice:</span>
              <span className="text-xs text-gray-900 ml-2">{formatted.content.tool_choice}</span>
            </div>
          )}
        </div>
        {formatted.content.instructions && (
          <div>
            <span className="text-xs font-semibold text-gray-700 block mb-2">Instructions:</span>
            <div className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border border-gray-200 max-h-64 overflow-y-auto scrollbar-hide-until-hover">
              {formatted.content.instructions}
            </div>
          </div>
        )}
      </>
    )
  }

  // Render JSON content
  const renderJsonContent = () => {
    const hasMetadata = formatted.structure === 'ai_input' && typeof formatted.content === 'object'
    
    // Extract image URLs from the JSON object
    const extractedImageUrls = extractImageUrlsFromObject(formatted.content)
    
    return (
      <div className="space-y-4">
        {hasMetadata && renderMetadata()}
        <div>
          {hasMetadata && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700">Input:</span>
            </div>
          )}
          <ExpandableContent
            content={contentString}
            renderContent={(displayContent, isExpanded) => (
              <>
                <div className="rounded-xl overflow-hidden border border-gray-200 scrollbar-hide-until-hover">
                  <SyntaxHighlighter
                    language="json"
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      padding: '16px',
                      fontSize: '13px',
                      maxHeight: isExpanded ? 'none' : '400px',
                      overflow: 'auto',
                      lineHeight: '1.6',
                    }}
                    showLineNumbers={contentString.length > 500}
                  >
                    {displayContent}
                  </SyntaxHighlighter>
                </div>
                {/* Render images found in JSON */}
                {extractedImageUrls.length > 0 && (
                  <div className="mt-5 md:mt-4 space-y-4 md:space-y-2">
                    {extractedImageUrls.map((url, idx) => (
                      <InlineImage key={`json-image-${idx}`} url={url} alt={`Image from JSON ${idx + 1}`} />
                    ))}
                  </div>
                )}
                {/* Render images from imageUrls prop */}
                {renderInlineImages()}
              </>
            )}
          />
        </div>
      </div>
    )
  }
  
  // Render HTML content
  const renderHtmlContent = () => {
    const htmlContent = typeof formatted.content === 'string' 
      ? formatted.content 
      : JSON.stringify(formatted.content, null, 2)
    
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setShowRendered(true)}
              className={`px-3 py-2 sm:py-1.5 text-xs font-medium rounded touch-target min-h-[44px] sm:min-h-0 ${
                showRendered 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Rendered
            </button>
            <button
              onClick={() => setShowRendered(false)}
              className={`px-3 py-2 sm:py-1.5 text-xs font-medium rounded touch-target min-h-[44px] sm:min-h-0 ${
                !showRendered 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Source
            </button>
          </div>
        </div>

        {showRendered ? (
          <>
          <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-white">
            <iframe
              srcDoc={htmlContent}
              className="w-full border-0"
              style={{ height: '600px', minHeight: '600px' }}
              sandbox="allow-same-origin"
              referrerPolicy="no-referrer"
              title="HTML Preview"
            />
          </div>
            {/* Render images from imageUrls prop even when showing rendered HTML */}
            {renderInlineImages()}
          </>
        ) : (
          <>
            <ExpandableContent
              content={htmlContent}
              renderContent={(displayContent) => (
                <div className="rounded-xl overflow-hidden border border-gray-200">
                  <SyntaxHighlighter
                    language="html"
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      padding: '16px',
                      fontSize: '13px',
                      maxHeight: '400px',
                      overflow: 'auto',
                      lineHeight: '1.6',
                    }}
                    showLineNumbers={htmlContent.length > 500}
                  >
                    {displayContent}
                  </SyntaxHighlighter>
                </div>
              )}
            />
            {/* Extract and render images from HTML source */}
            {(() => {
              const extractedUrls = extractImageUrls(htmlContent)
              return extractedUrls.length > 0 || imageUrls.length > 0 ? (
                <div className="mt-5 md:mt-4 space-y-4 md:space-y-2">
                  {extractedUrls.map((url, idx) => (
                    <InlineImage key={`html-image-${idx}`} url={url} alt={`Image from HTML ${idx + 1}`} />
                  ))}
                  {imageUrls.map((url, idx) => (
                    <InlineImage key={`html-prop-image-${idx}`} url={url} alt={`Image ${idx + 1}`} />
                  ))}
                </div>
              ) : null
            })()}
          </>
        )}
      </div>
    )
  }
  
  // Render Markdown content
  const renderMarkdownContent = () => {
    const hasMetadata = formatted.structure === 'ai_input' && typeof formatted.content === 'object'
    const markdownText = hasMetadata
      ? formatted.content.input || ''
      : typeof formatted.content === 'string'
        ? formatted.content
        : formatted.content.input || JSON.stringify(formatted.content, null, 2)
    
    // Extract image URLs from markdown (ReactMarkdown handles markdown image syntax, but we also want plain URLs)
    const extractedImageUrls = extractImageUrls(markdownText)
    
    return (
      <div className="space-y-4">
        {hasMetadata && renderMetadata()}
        <div>
          {hasMetadata && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700">Input:</span>
            </div>
          )}
          <ExpandableContent
            content={markdownText}
            renderContent={(displayContent) => (
              <>
                <div className="prose prose-sm max-w-none bg-white p-4 md:p-4 rounded-xl border border-gray-200 max-h-[600px] overflow-y-auto scrollbar-hide-until-hover leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {displayContent}
                  </ReactMarkdown>
                </div>
                {/* Render plain image URLs that aren't in markdown format */}
                {extractedImageUrls.length > 0 && (
                  <div className="mt-5 md:mt-4 space-y-4 md:space-y-2">
                    {extractedImageUrls.map((url, idx) => (
                      <InlineImage key={`md-image-${idx}`} url={url} alt={`Image from markdown ${idx + 1}`} />
                    ))}
                  </div>
                )}
                {/* Render images from imageUrls prop */}
                {renderInlineImages()}
              </>
            )}
          />
        </div>
      </div>
    )
  }
  
  // Render plain text content
  const renderTextContent = () => {
    return (
      <ExpandableContent
        content={contentString}
        renderContent={(displayContent) => {
          // Check if there are image URLs in the text
          const extractedUrls = extractImageUrls(displayContent)
          
          if (extractedUrls.length === 0 && (!imageUrls || imageUrls.length === 0)) {
            // No images in text or prop, render as plain text
            return (
              <>
                <pre className="text-sm md:text-xs whitespace-pre-wrap font-mono bg-gray-50 p-4 md:p-4 rounded-xl border border-gray-200 max-h-[500px] md:max-h-[600px] overflow-y-auto scrollbar-hide-until-hover leading-relaxed">
                  {displayContent}
                </pre>
                {/* Always check for images from prop */}
                {renderInlineImages()}
              </>
            )
          }
          
          // Has images in text, render with inline images
          return (
            <div className="bg-gray-50 p-4 md:p-4 rounded-xl border border-gray-200 max-h-[500px] md:max-h-[600px] overflow-y-auto scrollbar-hide-until-hover">
              <pre className="text-sm md:text-xs whitespace-pre-wrap font-mono leading-relaxed">
                {renderTextWithImages(displayContent)}
              </pre>
              {/* Render images from imageUrls prop */}
              {renderInlineImages()}
            </div>
          )
        }}
      />
    )
  }
  
  // Single return statement with conditional rendering
  return (
    <>
      {formatted.type === 'json' && renderJsonContent()}
      {formatted.type === 'html' && renderHtmlContent()}
      {formatted.type === 'markdown' && renderMarkdownContent()}
      {formatted.type === 'text' && renderTextContent()}
    </>
  )
}
