/**
 * Error boundary component
 */

'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { ErrorMessage } from './index'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-soft border border-white/60 p-6">
            <h2 className="text-xl font-bold text-ink-900 mb-4">Something went wrong</h2>
            {this.state.error && (
              <ErrorMessage message={this.state.error.message} />
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-2xl hover:bg-brand-700 shadow-soft"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
