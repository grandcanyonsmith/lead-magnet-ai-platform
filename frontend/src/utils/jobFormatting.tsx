/**
 * Job formatting utilities
 */

import React from 'react'
import { FiCheckCircle, FiXCircle, FiClock, FiLoader } from 'react-icons/fi'

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Queued',
    processing: 'Generating',
    completed: 'Ready',
    failed: 'Error',
  }
  return labels[status] || status
}

export function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <FiCheckCircle className="w-5 h-5 text-green-600" />
    case 'failed':
      return <FiXCircle className="w-5 h-5 text-red-600" />
    case 'processing':
      return <FiLoader className="w-5 h-5 text-blue-600 animate-spin" />
    default:
      return <FiClock className="w-5 h-5 text-yellow-600" />
  }
}

export function getStatusBadge(status: string) {
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    processing: 'bg-blue-100 text-blue-800',
    pending: 'bg-yellow-100 text-yellow-800',
  }
  return (
    <span className={`px-3 py-1 text-sm font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {getStatusLabel(status)}
    </span>
  )
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (seconds < 60) return `${seconds} seconds ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

export function formatDurationSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

export function isJSON(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

export function isMarkdown(str: string): boolean {
  if (typeof str !== 'string') return false
  // Check for common markdown patterns
  const markdownPatterns = [
    /^#{1,6}\s+.+/m,           // Headers
    /\*\*.*?\*\*/,            // Bold
    /\*.*?\*/,                // Italic
    /\[.*?\]\(.*?\)/,         // Links
    /^[-*+]\s+/m,             // Lists
    /^\d+\.\s+/m,             // Numbered lists
    /```[\s\S]*?```/,         // Code blocks
    /`[^`]+`/,                // Inline code
  ]
  return markdownPatterns.some(pattern => pattern.test(str))
}

export function isHTML(str: string): boolean {
  if (typeof str !== 'string') return false
  const trimmed = str.trim()
  // Check for HTML patterns
  const htmlPatterns = [
    /^<!DOCTYPE\s+html/i,           // DOCTYPE declaration
    /^<html[\s>]/i,                  // HTML tag
    /<\/html>\s*$/i,                 // Closing HTML tag
    /^<\!--[\s\S]*?-->/,            // HTML comment
  ]
  // Check if it contains HTML tags
  const hasHTMLTags = /<[a-z][\s\S]*>/i.test(trimmed)
  const hasClosingTags = /<\/[a-z]+>/i.test(trimmed)
  
  // If it has both opening and closing tags, or matches specific patterns
  return htmlPatterns.some(pattern => pattern.test(trimmed)) || (hasHTMLTags && hasClosingTags)
}

export function formatStepInput(step: any): { content: string | any, type: 'json' | 'markdown' | 'text', structure?: 'ai_input' } {
  if (step.step_type === 'form_submission') {
    return { content: step.input, type: 'json' }
  }
  if (step.input && typeof step.input === 'object') {
    // For AI steps, show instructions and input
    const inputObj = step.input as any
    const inputText = inputObj.input || ''
    
    // Check if input text is markdown
    if (typeof inputText === 'string' && isMarkdown(inputText)) {
      return {
        content: {
          model: step.model || 'N/A',
          instructions: inputObj.instructions || 'N/A',
          input: inputText
        },
        type: 'markdown',
        structure: 'ai_input'
      }
    }
    
    // Otherwise return as JSON
    return {
      content: {
        model: step.model || 'N/A',
        instructions: inputObj.instructions || 'N/A',
        input: inputObj.input || inputObj
      },
      type: 'json',
      structure: 'ai_input'
    }
  }
  return { content: step.input, type: 'json' }
}

export function formatStepOutput(step: any): { content: string | any, type: 'json' | 'markdown' | 'text' | 'html' } {
  if (step.step_type === 'final_output') {
    return { content: step.output, type: 'json' }
  }
  if (typeof step.output === 'string') {
    // Check if it's HTML first (before JSON, as HTML might contain JSON-like syntax)
    if (isHTML(step.output)) {
      return { content: step.output, type: 'html' }
    }
    // Check if it's JSON
    if (isJSON(step.output)) {
      try {
        return { content: JSON.parse(step.output), type: 'json' }
      } catch {
        // If parsing fails, treat as text
      }
    }
    // Check if it's Markdown
    if (isMarkdown(step.output)) {
      return { content: step.output, type: 'markdown' }
    }
    return { content: step.output, type: 'text' }
  }
  return { content: step.output, type: 'json' }
}

