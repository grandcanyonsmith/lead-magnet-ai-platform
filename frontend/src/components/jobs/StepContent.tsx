'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'

const MAX_PREVIEW_LENGTH = 1000

interface StepContentProps {
  formatted: { content: any, type: 'json' | 'markdown' | 'text' | 'html', structure?: 'ai_input' }
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
                Show More ({content.length.toLocaleString()} chars)
              </>
            )}
          </button>
        </div>
      )}
      {renderContent(displayContent, isExpanded)}
    </div>
  )
}

export function StepContent({ formatted }: StepContentProps) {
  const [showRendered, setShowRendered] = useState(true)
  
  const getContentString = (): string => {
    if (typeof formatted.content === 'string') {
      return formatted.content
    }
    return JSON.stringify(formatted.content, null, 2)
  }
  
  const contentString = getContentString()
  
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
            <div className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border border-gray-200 max-h-64 overflow-y-auto">
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
              className={`px-3 py-1.5 text-xs font-medium rounded ${
                showRendered 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Rendered
            </button>
            <button
              onClick={() => setShowRendered(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded ${
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
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <iframe
              srcDoc={htmlContent}
              className="w-full border-0"
              style={{ height: '600px', minHeight: '600px' }}
              sandbox="allow-same-origin"
              referrerPolicy="no-referrer"
              title="HTML Preview"
            />
          </div>
        ) : (
          <ExpandableContent
            content={htmlContent}
            renderContent={(displayContent) => (
              <div className="rounded-lg overflow-hidden border border-gray-200">
                <SyntaxHighlighter
                  language="html"
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    padding: '12px',
                    fontSize: '12px',
                    maxHeight: '400px',
                    overflow: 'auto',
                  }}
                  showLineNumbers={htmlContent.length > 500}
                >
                  {displayContent}
                </SyntaxHighlighter>
              </div>
            )}
          />
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
              <div className="prose prose-sm max-w-none bg-white p-4 rounded-lg border border-gray-200 max-h-[600px] overflow-y-auto">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {displayContent}
                </ReactMarkdown>
              </div>
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
        renderContent={(displayContent) => (
          <pre className="text-sm whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-[600px] overflow-y-auto">
            {displayContent}
          </pre>
        )}
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
