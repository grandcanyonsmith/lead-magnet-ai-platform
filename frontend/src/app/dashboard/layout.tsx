'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { signOut, isAuthenticated } from '@/lib/auth'
import { 
  FiHome, 
  FiSettings, 
  FiFileText, 
  FiLayout, 
  FiList, 
  FiBarChart2,
  FiLogOut,
  FiMenu,
  FiX
} from 'react-icons/fi'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      // Small delay to ensure localStorage and Cognito SDK are ready
      await new Promise(resolve => setTimeout(resolve, 100))
      
      try {
        const authenticated = await isAuthenticated()
        if (!authenticated) {
          console.log('Not authenticated, redirecting to login')
          router.push('/auth/login')
        } else {
          console.log('Authenticated, showing dashboard')
          setLoading(false)
        }
      } catch (error) {
        console.error('Auth check error:', error)
        router.push('/auth/login')
      }
    }
    checkAuth()
  }, [router])

  const handleSignOut = () => {
    signOut()
    router.push('/auth/login')
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: FiHome },
    { href: '/dashboard/workflows', label: 'Workflows', icon: FiList },
    { href: '/dashboard/forms', label: 'Forms', icon: FiFileText },
    { href: '/dashboard/templates', label: 'Templates', icon: FiLayout },
    { href: '/dashboard/jobs', label: 'Lead Magnets', icon: FiBarChart2 },
    { href: '/dashboard/artifacts', label: 'Artifacts', icon: FiFileText },
    { href: '/dashboard/settings', label: 'Settings', icon: FiSettings },
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-30 h-full w-64 bg-white shadow-xl border-r border-gray-200 transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-white">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center mr-2">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-900">Lead Magnet AI</h1>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-600 hover:text-gray-900 p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <nav className="mt-6 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center px-3 py-2.5 mb-1 rounded-lg transition-all duration-200
                  ${
                    isActive
                      ? 'bg-gradient-to-r from-primary-50 to-primary-100 text-primary-700 shadow-sm border-l-4 border-primary-500'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-primary-600' : ''}`} />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleSignOut}
            className="flex items-center w-full px-3 py-2.5 text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all duration-200"
          >
            <FiLogOut className="w-5 h-5 mr-3" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top bar */}
        <header className="bg-white shadow-sm h-16 flex items-center px-4 lg:px-6 border-b border-gray-200 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-600 hover:text-gray-900 mr-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <FiMenu className="w-6 h-6" />
          </button>
          <div className="flex-1" />
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8 bg-gray-50 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  )
}

