'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { queryClient } from '@/shared/lib/react-query'
import { AuthProvider } from '@/features/auth/lib'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            success: {
              duration: 3000,
              style: {
                background: '#10b981',
                color: '#ffffff',
              },
            },
            error: {
              duration: 5000,
              style: {
                background: '#ef4444',
                color: '#ffffff',
              },
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  )
}
