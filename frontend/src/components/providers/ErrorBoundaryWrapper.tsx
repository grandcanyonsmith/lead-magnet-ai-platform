'use client'

import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

export function ErrorBoundaryWrapper({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>
}
