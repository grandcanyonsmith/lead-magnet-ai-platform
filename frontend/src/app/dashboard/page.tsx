'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import { FiActivity, FiCheckCircle, FiXCircle, FiClock, FiTrendingUp, FiFileText, FiLayout } from 'react-icons/fi'

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
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6">
              <div className="h-12 bg-gray-200 rounded w-12 mb-4 animate-pulse"></div>
              <div className="h-8 bg-gray-200 rounded w-24 mb-2 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    )
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
            <div key={stat.label} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 border border-gray-100 group">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ${colorMap[stat.color]} group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</p>
              <p className="text-sm text-gray-600 font-medium">{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/dashboard/workflows/new"
            className="flex items-center justify-center px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            <FiActivity className="w-5 h-5 mr-2" />
            Create Workflow
          </a>
          <a
            href="/dashboard/forms/new"
            className="flex items-center justify-center px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            <FiFileText className="w-5 h-5 mr-2" />
            Create Form
          </a>
          <a
            href="/dashboard/templates/new"
            className="flex items-center justify-center px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            <FiLayout className="w-5 h-5 mr-2" />
            Create Template
          </a>
        </div>
      </div>

      {/* Additional Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Overview</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
              <span className="text-gray-600">Total Submissions</span>
              <span className="font-semibold text-gray-900">{overview.total_submissions || 0}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
              <span className="text-gray-600">Total Workflows</span>
              <span className="font-semibold text-gray-900">{overview.total_workflows || 0}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
              <span className="text-gray-600">Active Workflows</span>
              <span className="font-semibold text-green-600">{overview.active_workflows || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            Monitor your recent jobs and submissions in the{' '}
            <a href="/dashboard/jobs" className="text-primary-600 hover:text-primary-700 font-medium">
              Jobs section
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}

