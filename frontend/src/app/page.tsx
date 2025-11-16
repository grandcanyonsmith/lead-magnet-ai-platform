'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CanyonButton } from '@/shared/components/ui/CanyonButton'

export default function Home() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) {
      return
    }

    try {
      // Redirect to dashboard if authenticated, otherwise to login
      const token = localStorage.getItem('access_token')
      
      if (token) {
        router.push('/dashboard')
      } else {
        router.push('/auth/login')
      }
    } catch (error) {
      // Handle errors gracefully - fallback to login page
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      // Fallback to login page on error
      setTimeout(() => {
        router.push('/auth/login')
      }, 2000)
    }
  }, [router, mounted])

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl bg-white/95 p-8 text-center shadow-2xl">
          <h1 className="text-2xl font-bold mb-4 text-canyon-green">Error</h1>
          <p className="text-red-600 mb-4">{error}</p>
          <p className="text-canyon-green/80 text-sm">Redirecting to login...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-xl rounded-3xl bg-white/95 p-10 text-center shadow-[0_25px_60px_rgba(0,0,0,0.25)]">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-canyon-green/80">
          Lead Magnet AI
        </p>
        <h1 className="text-4xl font-bold mb-4 text-canyon-green">Preparing your workspace</h1>
        <p className="text-lg text-canyon-green/80">Loading...</p>
        {mounted && (
          <p className="text-sm text-canyon-green/70 mt-2">
            Checking authentication...
          </p>
        )}
        <div className="mt-8 flex justify-center">
          <CanyonButton onClick={() => alert('Canyon Button Clicked!')}>
            Click Me
          </CanyonButton>
        </div>
      </div>
    </main>
  )
}

