'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-6">
          <h1 className="text-2xl font-bold mb-4 text-gray-900">Error</h1>
          <p className="text-red-600 mb-4">{error}</p>
          <p className="text-gray-600 text-sm">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">Lead Magnet AI Platform</h1>
        <p className="text-gray-600">Loading...</p>
        {mounted && (
          <p className="text-sm text-gray-400 mt-2">Checking authentication...</p>
        )}
      </div>
    </div>
  )
}

