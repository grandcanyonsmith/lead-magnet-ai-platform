'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { formatStepInput, formatStepOutput } from '@/utils/jobFormatting'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'

interface StepContentProps {
  formatted: { content: any, type: 'json' | 'markdown' | 'text', structure?: 'ai_input' }
}

const MAX_PREVIEW_LENGTH = 1000

export function StepContent({ formatted }: StepContentProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const getContentString = (): string => {
    if (formatted.type === 'json') {
      return typeof formatted.content === 'string' 
        ? formatted.content 
        : JSON.stringify(formatted.content, null, 2)
    }
    return typeof formatted.content === 'string' 
      ? formatted.content 
      : JSON.stringify(formatted.content, null, 2)
  }
  
  const contentString = getContentString()
  const isLongContent = contentString.length > MAX_PREVIEW_LENGTH
  const displayContent = isLongContent && !isExpanded 
    ? contentString.substring(0, MAX_PREVIEW_LENGTH) + '...'
    : contentString
  
  if (formatted.type === 'json') {
    // For AI input structure, show model and instructions separately, then formatted JSON input
    if (formatted.structure === 'ai_input' && typeof formatted.content === 'object') {
      return (
        <div className="space-y-4">
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
              <div className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border border-gray-200 max-h-64 overflow-y-auto">
                {formatted.content.instructions}
              </div>
            </div>
          )}
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700">Input:</span>
              {isLongContent && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  {isExpanded ? (
                    <>
                      <FiChevronUp className="w-3 h-3" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <FiChevronDown className="w-3 h-3" />
                      Show More ({contentString.length.toLocaleString()} chars)
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="rounded-lg overflow-hidden border border-gray-200">
              <SyntaxHighlighter
                language="json"
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  padding: '12px',
                  fontSize: '12px',
                  maxHeight: isExpanded ? 'none' : '400px',
                  overflow: 'auto',
                }}
                showLineNumbers={contentString.length > 500}
              >
                {displayContent}
              </SyntaxHighlighter>
            </div>
          </div>
        </div>
      )
    }
    
    // Regular JSON content
    return (
      <div>
        {isLongContent && (
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              {isExpanded ? (
                <>
                  <FiChevronUp className="w-3 h-3" />
                  Show Less
                </>
              ) : (
                <>
                  <FiChevronDown className="w-3 h-3" />
                  Show More ({contentString.length.toLocaleString()} chars)
                </>
              )}
            </button>
          </div>
        )}
        <div className="rounded-lg overflow-hidden border border-gray-200">
          <SyntaxHighlighter
            language="json"
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: '12px',
              fontSize: '12px',
              maxHeight: isExpanded ? 'none' : '400px',
              overflow: 'auto',
            }}
            showLineNumbers={contentString.length > 500}
          >
            {displayContent}
          </SyntaxHighlighter>
        </div>
      </div>
    )
  }
  
  if (formatted.type === 'markdown') {
    // For AI input structure, show model and instructions separately, then render markdown input
    if (formatted.structure === 'ai_input' && typeof formatted.content === 'object') {
      const markdownContent = formatted.content.input || ''
      return (
        <div className="space-y-4">
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
              <div className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border border-gray-200 max-h-64 overflow-y-auto">
                {formatted.content.instructions}
              </div>
            </div>
          )}
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700">Input:</span>
              {markdownContent.length > MAX_PREVIEW_LENGTH && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  {isExpanded ? (
                    <>
                      <FiChevronUp className="w-3 h-3" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <FiChevronDown className="w-3 h-3" />
                      Show More ({markdownContent.length.toLocaleString()} chars)
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="prose prose-sm max-w-none bg-white p-4 rounded-lg border border-gray-200 max-h-[600px] overflow-y-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {isExpanded || markdownContent.length <= MAX_PREVIEW_LENGTH 
                  ? markdownContent 
                  : markdownContent.substring(0, MAX_PREVIEW_LENGTH) + '...'}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )
    }
    
    // Regular markdown content
    const markdownText = typeof formatted.content === 'string' 
      ? formatted.content 
      : formatted.content.input || JSON.stringify(formatted.content, null, 2)
    
    return (
      <div>
        {markdownText.length > MAX_PREVIEW_LENGTH && (
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              {isExpanded ? (
                <>
                  <FiChevronUp className="w-3 h-3" />
                  Show Less
                </>
              ) : (
                <>
                  <FiChevronDown className="w-3 h-3" />
                  Show More ({markdownText.length.toLocaleString()} chars)
                </>
              )}
            </button>
          </div>
        )}
        <div className="prose prose-sm max-w-none bg-white p-4 rounded-lg border border-gray-200 max-h-[600px] overflow-y-auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {isExpanded || markdownText.length <= MAX_PREVIEW_LENGTH 
              ? markdownText 
              : markdownText.substring(0, MAX_PREVIEW_LENGTH) + '...'}
          </ReactMarkdown>
        </div>
      </div>
    )
  }
  
  // Plain text content
  return (
    <div>
      {contentString.length > MAX_PREVIEW_LENGTH && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            {isExpanded ? (
              <>
                <FiChevronUp className="w-3 h-3" />
                Show Less
              </>
            ) : (
              <>
                <FiChevronDown className="w-3 h-3" />
                Show More ({contentString.length.toLocaleString()} chars)
              </>
            )}
          </button>
        </div>
      )}
      <pre className="text-sm whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-[600px] overflow-y-auto">
        {displayContent}
      </pre>
    </div>
  )
}

// Export formatting functions for use in components
export { formatStepInput, formatStepOutput }

