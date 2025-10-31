'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import { FiActivity, FiCheckCircle, FiXCircle, FiClock, FiTrendingUp } from 'react-icons/fi'

export default function DashboardPage() {
  const router = useRouter()
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const checkAndLoad = async () => {
      // Wait a bit for auth to be ready
      await new Promise(resolve => setTimeout(resolve, 150))
      
      const authenticated = await isAuthenticated()
      if (!authenticated) {
        router.push('/auth/login')
        return
      }
      
      setAuthChecked(true)
      await loadAnalytics()
    }
    
    checkAndLoad()
  }, [router])

  const loadAnalytics = async () => {
    try {
      const data = await api.getAnalytics({ days: 30 })
      setAnalytics(data)
    } catch (error: any) {
      console.error('Failed to load analytics:', error)
      // Don't redirect on API errors - just show empty state
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  const overview = analytics?.overview || {}
  
  const stats = [
    {
      label: 'Total Jobs',
      value: overview.total_jobs || 0,
      icon: FiActivity,
      color: 'blue',
    },
    {
      label: 'Completed Jobs',
      value: overview.completed_jobs || 0,
      icon: FiCheckCircle,
      color: 'green',
    },
    {
      label: 'Failed Jobs',
      value: overview.failed_jobs || 0,
      icon: FiXCircle,
      color: 'red',
    },
    {
      label: 'Pending Jobs',
      value: overview.pending_jobs || 0,
      icon: FiClock,
      color: 'yellow',
    },
    {
      label: 'Success Rate',
      value: `${overview.success_rate || 0}%`,
      icon: FiTrendingUp,
      color: 'purple',
    },
    {
      label: 'Avg Processing Time',
      value: `${overview.avg_processing_time_seconds || 0}s`,
      icon: FiClock,
      color: 'indigo',
    },
  ]

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-purple-100 text-purple-600',
    indigo: 'bg-indigo-100 text-indigo-600',
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Overview of your lead magnet platform</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${colorMap[stat.color]}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-600">{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/dashboard/workflows/new"
            className="flex items-center justify-center px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Create Workflow
          </a>
          <a
            href="/dashboard/forms/new"
            className="flex items-center justify-center px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Create Form
          </a>
          <a
            href="/dashboard/templates/new"
            className="flex items-center justify-center px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Create Template
          </a>
        </div>
      </div>

      {/* Additional Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Overview</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Submissions</span>
              <span className="font-medium">{overview.total_submissions || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Workflows</span>
              <span className="font-medium">{overview.total_workflows || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Active Workflows</span>
              <span className="font-medium">{overview.active_workflows || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <p className="text-gray-600 text-sm">
            Monitor your recent jobs and submissions in the Jobs section.
          </p>
        </div>
      </div>
    </div>
  )
}

