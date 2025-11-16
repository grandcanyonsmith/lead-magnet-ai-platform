'use client'

import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary'

export function ErrorBoundaryWrapper({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>
}
