'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { isAuthenticated } from '@/features/auth/lib'
import { UserMenu } from '@/shared/components/UserMenu'
import { ImpersonationBanner } from '@/shared/components/ImpersonationBanner'
import {
  FiHome,
  FiList,
  FiMenu,
  FiX,
} from 'react-icons/fi'
import {
  Shell,
  ShellSidebar,
  ShellContent,
  ShellNavItem,
} from '@/shared/components/layout/shell'

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
          if (process.env.NODE_ENV === 'development') {
            console.log('Not authenticated, redirecting to login')
          }
          router.push('/auth/login')
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.log('Authenticated, showing dashboard')
          }
          setLoading(false)
        }
      } catch (error) {
        console.error('Auth check error:', error)
        router.push('/auth/login')
      }
    }
    checkAuth()
  }, [router])


  const navItems = useMemo(
    () => [
      { href: '/dashboard', label: 'Dashboard', icon: FiHome },
      { href: '/dashboard/workflows', label: 'Lead Magnets', icon: FiList },
    ],
    []
  )


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
    <Shell sidebarOpen={sidebarOpen} onSidebarOpenChange={setSidebarOpen}>
        <ShellSidebar>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-surface-200 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-sm font-semibold text-white">
                  LM
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-ink-900">Lead Magnet AI</p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-2xl border border-surface-200 p-2 text-ink-400 transition hover:text-ink-900 lg:hidden"
                aria-label="Close navigation"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-4 py-6">
              <div className="space-y-1.5">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                  return (
                    <ShellNavItem
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      isActive={isActive}
                    />
                  )
                })}
              </div>
            </nav>
            <div className="border-t border-surface-200 px-4 py-4">
              <UserMenu />
            </div>
          </div>
        </ShellSidebar>

        <div className="flex min-h-screen flex-1 flex-col lg:pl-[20rem]">
          <ImpersonationBanner />
          <div className="lg:hidden fixed top-4 left-4 z-50">
            <button
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-surface-200 bg-white text-ink-500 transition hover:text-ink-900 shadow-lg"
              aria-label="Open menu"
            >
              <FiMenu className="h-5 w-5" />
            </button>
          </div>
          <ShellContent className="w-full bg-surface-50">
            <main className="space-y-6">{children}</main>
          </ShellContent>
        </div>

      </Shell>
  )
}
