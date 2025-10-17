'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to dashboard if authenticated, otherwise to login
    const token = localStorage.getItem('access_token')
    if (token) {
      router.push('/dashboard')
    } else {
      router.push('/auth/login')
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Lead Magnet AI Platform</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}

