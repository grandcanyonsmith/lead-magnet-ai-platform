'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { isAuthenticated, useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { OnboardingChecklist } from '@/components/OnboardingChecklist'
import { TourProvider } from '@/components/TourProvider'
import { TourId } from '@/lib/tours'
import { NotificationBell } from '@/components/NotificationBell'
import { UserMenu } from '@/components/UserMenu'
import { SearchModal } from '@/components/SearchModal'
import { ShortcutsHelpModal } from '@/components/ShortcutsHelpModal'
import { ImpersonationBanner } from '@/components/ImpersonationBanner'
import { UserImpersonation } from '@/components/UserImpersonation'
import { ViewSwitcher } from '@/components/ViewSwitcher'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { 
  FiHome, 
  FiSettings, 
  FiFileText, 
  FiList, 
  FiBarChart2,
  FiMenu,
  FiX,
  FiSearch,
  FiUsers
} from 'react-icons/fi'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { role } = useAuth()
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settings, setSettings] = useState<any>(null)
  const [activeTourId, setActiveTourId] = useState<TourId | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false)

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
          // Load settings for onboarding checklist
          loadSettings()
        }
      } catch (error) {
        console.error('Auth check error:', error)
        router.push('/auth/login')
      }
    }
    checkAuth()
  }, [router])

  const loadSettings = async () => {
    try {
      const data = await api.getSettings()
      setSettings(data)
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const handleStartTour = (tourId: TourId) => {
    setActiveTourId(tourId)
  }

  const handleTourComplete = async (tourId: TourId) => {
    setActiveTourId(null)
    
    // Mark checklist item as complete
    if (!settings) return
    
    const checklist = settings.onboarding_checklist || {}
    let updatedChecklist = { ...checklist }
    
    if (tourId === 'settings') {
      updatedChecklist.complete_profile = true
    } else if (tourId === 'create-workflow') {
      updatedChecklist.create_first_lead_magnet = true
    } else if (tourId === 'view-jobs') {
      updatedChecklist.view_generated_lead_magnets = true
    }
    
    try {
      await api.updateOnboardingChecklist(updatedChecklist)
      // Reload settings to update UI
      await loadSettings()
    } catch (error) {
      console.error('Failed to update checklist:', error)
      // Error is already handled by the component's error handling
      // This is just for logging
    }
  }

  const handleTourSkip = () => {
    setActiveTourId(null)
  }

  const baseNavItems = [
    { href: '/dashboard', label: 'Dashboard', icon: FiHome },
    { href: '/dashboard/workflows', label: 'Lead Magnets', icon: FiList },
    { href: '/dashboard/jobs', label: 'Generated Lead Magnets', icon: FiBarChart2 },
    { href: '/dashboard/artifacts', label: 'Downloads', icon: FiFileText },
    { href: '/dashboard/files', label: 'Files', icon: FiFileText },
    { href: '/dashboard/settings', label: 'Settings', icon: FiSettings },
  ]
  const navItems = role === 'SUPER_ADMIN'
    ? [
        ...baseNavItems,
        { href: '/dashboard/agency/users', label: 'Agency Users', icon: FiUsers },
      ]
    : baseNavItems

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSearch: () => setSearchOpen(true),
    onShortcutsHelp: () => setShortcutsHelpOpen(true),
    onNavigate: (index) => {
      if (navItems[index]) {
        router.push(navItems[index].href)
      }
    },
    onClose: () => {
      setSearchOpen(false)
      setShortcutsHelpOpen(false)
      setSidebarOpen(false)
    },
    navItemsCount: navItems.length,
    enabled: !loading,
  })

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
    <TourProvider
      activeTourId={activeTourId}
      onTourComplete={handleTourComplete}
      onTourSkip={handleTourSkip}
    >
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
            fixed top-0 left-0 z-30 h-full w-64 sm:w-72 bg-white shadow-xl border-r border-gray-200 transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0
          `}
        >
        <div className="flex items-center justify-between h-16 px-5 sm:px-6 border-b border-gray-200 bg-gradient-to-r from-primary-50 via-primary-50/50 to-white">
          <div className="flex items-center">
            <div className="h-8 w-8 sm:h-9 sm:w-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center mr-3 shadow-sm">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Lead Magnet AI</h1>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-all duration-200 touch-target"
            aria-label="Close menu"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <nav className="mt-6 px-3 sm:px-4 space-y-1">
          {navItems.map((item, index) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  group flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium
                  ${
                    isActive
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md shadow-primary-500/20 scale-[1.02]'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 hover:scale-[1.01]'
                  }
                `}
              >
                <Icon className={`w-5 h-5 mr-3 flex-shrink-0 transition-transform duration-200 ${
                  isActive 
                    ? 'text-white' 
                    : 'text-gray-500 group-hover:text-gray-700 group-hover:scale-110'
                }`} />
                <span className="truncate">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/80"></div>
                )}
              </Link>
            )
          })}
        </nav>
      </aside>

        {/* Main content */}
        <div className="lg:ml-64">
          {/* Impersonation Banner */}
          <ImpersonationBanner />
          
          {/* Top bar */}
          <header className="bg-white/80 backdrop-blur-sm shadow-sm h-16 flex items-center px-4 sm:px-5 lg:px-6 border-b border-gray-200 sticky top-0 z-10">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-600 hover:text-gray-900 mr-3 sm:mr-4 p-2 rounded-lg hover:bg-gray-100 transition-all duration-200 touch-target"
              aria-label="Open menu"
            >
              <FiMenu className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-200 hover:border-gray-300"
                aria-label="Search"
              >
                <FiSearch className="w-4 h-4" />
                <span className="text-gray-500">Search</span>
                <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-300 rounded">
                  ⌘K
                </kbd>
              </button>
              <button
                onClick={() => setSearchOpen(true)}
                className="sm:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors touch-target"
                aria-label="Search"
              >
                <FiSearch className="w-5 h-5" />
              </button>
              <ViewSwitcher />
              <UserImpersonation />
              <NotificationBell />
              <UserMenu />
            </div>
          </header>

          {/* Page content */}
          <main className="p-4 sm:p-5 md:p-6 lg:p-8 bg-gray-50 min-h-screen">
            {children}
          </main>
        </div>

        {/* Search Modal */}
        <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

        {/* Shortcuts Help Modal */}
        <ShortcutsHelpModal isOpen={shortcutsHelpOpen} onClose={() => setShortcutsHelpOpen(false)} />

        {/* Onboarding Checklist Widget */}
        {settings && (
          <OnboardingChecklist settings={settings} onStartTour={handleStartTour} />
        )}
      </div>
    </TourProvider>
  )
}
