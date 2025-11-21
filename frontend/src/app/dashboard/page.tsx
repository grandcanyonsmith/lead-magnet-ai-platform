'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticated } from '@/features/auth/lib'
import { FiActivity, FiFileText } from 'react-icons/fi'

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAndLoad = async () => {
      await new Promise(resolve => setTimeout(resolve, 150))
      
      const authenticated = await isAuthenticated()
      if (!authenticated) {
        router.push('/auth/login')
        return
      }
      
      setLoading(false)
    }
    
    checkAndLoad()
  }, [router])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="h-8 bg-ink-200 rounded w-48 mb-2 animate-pulse"></div>
          <div className="h-5 bg-ink-200 rounded w-64 animate-pulse"></div>
        </div>
        <div className="space-y-6">
          <div className="h-24 bg-white rounded-2xl shadow-soft border border-white/60 animate-pulse"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-24 bg-white rounded-2xl shadow-soft border border-white/60 animate-pulse"></div>
            <div className="h-24 bg-white rounded-2xl shadow-soft border border-white/60 animate-pulse"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink-900 mb-2">Dashboard</h1>
        <p className="text-ink-600">Create AI-powered lead magnets</p>
      </div>

      <div className="space-y-6">
        <a
          href="/dashboard/workflows/new"
          className="block w-full bg-brand-600 text-white rounded-2xl hover:bg-brand-700 transition-colors shadow-soft p-6 text-center focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
        >
          <FiActivity className="w-6 h-6 mx-auto mb-2" />
          <span className="text-lg font-medium">Create Lead Magnet</span>
        </a>

        <div className="grid grid-cols-2 gap-4">
          <a
            href="/dashboard/workflows"
            className="bg-white rounded-2xl shadow-soft border border-white/60 p-6 hover:shadow-md transition-shadow text-center"
          >
            <FiFileText className="w-5 h-5 mx-auto mb-2 text-brand-600" />
            <div className="text-sm font-medium text-ink-900">Lead Magnets</div>
          </a>
          <a
            href="/dashboard/jobs"
            className="bg-white rounded-2xl shadow-soft border border-white/60 p-6 hover:shadow-md transition-shadow text-center"
          >
            <FiActivity className="w-5 h-5 mx-auto mb-2 text-brand-600" />
            <div className="text-sm font-medium text-ink-900">Generated</div>
          </a>
        </div>
      </div>
    </div>
  )
}

