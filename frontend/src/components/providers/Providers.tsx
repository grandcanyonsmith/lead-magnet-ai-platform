'use client'

import { Toaster } from 'react-hot-toast'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
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
    </>
  )
}
