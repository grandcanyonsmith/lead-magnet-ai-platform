'use client'

import { useAuth } from '@/features/auth/lib/auth/context'
import { useState, useEffect } from 'react'
import { api } from '@/shared/lib/api'
import { FiUsers, FiBriefcase, FiChevronDown } from 'react-icons/fi'

interface Customer {
  customer_id: string
  name: string
  email: string
  user_count: number
}

export function ViewSwitcher() {
  const { role, viewMode, setViewMode, selectedCustomerId, customerId } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadCustomers = async () => {
    setIsLoading(true)
    try {
      const response = await api.get<{ customers: Customer[] }>('/admin/agency/customers', {
        params: { limit: 100 },
      })
      setCustomers(response.customers || [])
    } catch (error) {
      console.error('Error loading customers:', error)
      setCustomers([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (viewMode === 'agency' && isOpen) {
      loadCustomers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, isOpen])

  // Only show for SUPER_ADMIN
  // Debug: Log role to help troubleshoot
  if (process.env.NODE_ENV === 'development') {
    console.log('[ViewSwitcher] Current role:', role)
  }
  
  if (role !== 'SUPER_ADMIN') {
    return null
  }

  const handleSwitchToAgency = () => {
    setViewMode('agency')
    setIsOpen(false)
  }

  const handleSwitchToSubaccount = (customerId?: string) => {
    setViewMode('subaccount', customerId)
    setIsOpen(false)
  }

  const currentCustomer = customers.find(c => c.customer_id === selectedCustomerId || c.customer_id === customerId)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex min-h-[44px] items-center gap-1.5 rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-sm font-medium text-ink-500 shadow-soft transition hover:text-ink-900 sm:min-h-0"
        aria-label="Switch view mode"
      >
        {viewMode === 'agency' ? (
          <>
            <FiBriefcase className="h-4 w-4 flex-shrink-0" />
            <span className="hidden md:inline">Agency View</span>
          </>
        ) : (
          <>
            <FiUsers className="h-4 w-4 flex-shrink-0" />
            <span className="hidden md:inline">
              {currentCustomer ? currentCustomer.name : 'Subaccount View'}
            </span>
          </>
        )}
        <FiChevronDown className="h-4 w-4 flex-shrink-0 text-ink-300" />
      </button>

      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-25 z-40 md:hidden"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 z-50 mt-3 flex max-h-[calc(100vh-8rem)] w-[calc(100vw-1rem)] max-w-[20rem] flex-col rounded-3xl border border-white/60 bg-white/95 shadow-soft backdrop-blur-xl sm:w-80 md:right-0 md:w-72">
            <div className="flex-shrink-0 border-b border-white/60 px-4 py-3">
              <h3 className="text-base font-semibold text-ink-900">Switch View</h3>
            </div>
            <div className="p-2 overflow-y-auto flex-1">
              <button
                onClick={handleSwitchToAgency}
                className={`w-full rounded-2xl px-3 py-2.5 text-left text-sm transition ${
                  viewMode === 'agency'
                    ? 'bg-brand-50 text-brand-700 shadow-ring'
                    : 'text-ink-600 hover:bg-white/70'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FiBriefcase className="h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-ink-900">Agency View</div>
                    <div className="text-xs text-ink-400">Manage all users and accounts</div>
                  </div>
                </div>
              </button>

              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink-400">
                  Subaccounts
                </div>
                {isLoading ? (
                  <div className="px-3 py-2 text-sm text-ink-400">Loading...</div>
                ) : customers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-ink-400">No customers found</div>
                ) : (
                  <div className="max-h-48 overflow-y-auto sm:max-h-60">
                    {customers.map((customer) => (
                      <button
                        key={customer.customer_id}
                        onClick={() => handleSwitchToSubaccount(customer.customer_id)}
                        className={`w-full rounded-2xl px-3 py-2.5 text-left text-sm transition ${
                          (selectedCustomerId === customer.customer_id || customerId === customer.customer_id) &&
                          viewMode === 'subaccount'
                            ? 'bg-brand-50 text-brand-700 shadow-ring'
                            : 'text-ink-600 hover:bg-white/70'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-ink-900">
                            {customer.name || customer.customer_id}
                          </div>
                          <div className="text-xs text-ink-400">
                            {customer.user_count} {customer.user_count === 1 ? 'user' : 'users'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

