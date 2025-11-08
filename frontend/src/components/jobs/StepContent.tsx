'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { formatStepInput, formatStepOutput } from '@/utils/jobFormatting'

interface StepContentProps {
  formatted: { content: any, type: 'json' | 'markdown' | 'text', structure?: 'ai_input' }
}

export function StepContent({ formatted }: StepContentProps) {
  if (formatted.type === 'json') {
    // For AI input structure, show model and instructions separately, then formatted JSON input
    if (formatted.structure === 'ai_input' && typeof formatted.content === 'object') {
      return (
        <div className="space-y-3">
          <div>
            <span className="text-xs font-semibold text-gray-700">Model:</span>
            <span className="text-xs text-gray-900 ml-2">{formatted.content.model}</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-700">Instructions:</span>
            <div className="text-xs text-gray-900 mt-1 whitespace-pre-wrap bg-gray-100 p-2 rounded max-h-48 overflow-y-auto">
              {formatted.content.instructions}
            </div>
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-700">Input:</span>
            <pre className="text-xs font-mono mt-1 bg-gray-100 p-2 rounded max-h-96 overflow-y-auto">
              <code>{typeof formatted.content.input === 'string' ? formatted.content.input : JSON.stringify(formatted.content.input, null, 2)}</code>
            </pre>
          </div>
        </div>
      )
    }
    return (
      <pre className="text-xs font-mono">
        <code>{JSON.stringify(formatted.content, null, 2)}</code>
      </pre>
    )
  }
  if (formatted.type === 'markdown') {
    // For AI input structure, show model and instructions separately, then render markdown input
    if (formatted.structure === 'ai_input' && typeof formatted.content === 'object') {
      const markdownContent = formatted.content.input || ''
      return (
        <div className="space-y-3">
          <div>
            <span className="text-xs font-semibold text-gray-700">Model:</span>
            <span className="text-xs text-gray-900 ml-2">{formatted.content.model}</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-700">Instructions:</span>
            <div className="text-xs text-gray-900 mt-1 whitespace-pre-wrap bg-gray-100 p-2 rounded">
              {formatted.content.instructions}
            </div>
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-700">Input:</span>
            <div className="prose prose-sm max-w-none mt-1">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {markdownContent}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {typeof formatted.content === 'string' ? formatted.content : formatted.content.input || JSON.stringify(formatted.content, null, 2)}
        </ReactMarkdown>
      </div>
    )
  }
  return <pre className="text-xs whitespace-pre-wrap font-mono">{formatted.content}</pre>
}

// Export formatting functions for use in components
export { formatStepInput, formatStepOutput }

