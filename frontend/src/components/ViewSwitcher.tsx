'use client'

import { useAuth } from '@/lib/auth/context'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
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
        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-200 hover:border-gray-300 touch-target min-h-[44px] sm:min-h-0"
        aria-label="Switch view mode"
      >
        {viewMode === 'agency' ? (
          <>
            <FiBriefcase className="w-4 h-4 flex-shrink-0" />
            <span className="hidden md:inline">Agency View</span>
          </>
        ) : (
          <>
            <FiUsers className="w-4 h-4 flex-shrink-0" />
            <span className="hidden md:inline">
              {currentCustomer ? currentCustomer.name : 'Subaccount View'}
            </span>
          </>
        )}
        <FiChevronDown className="w-4 h-4 flex-shrink-0" />
      </button>

      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-25 z-40 md:hidden"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 md:right-0 mt-2 w-[calc(100vw-1rem)] max-w-[20rem] sm:w-80 md:w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-[calc(100vh-8rem)] flex flex-col">
            <div className="p-3 sm:p-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Switch View</h3>
            </div>
            <div className="p-2 overflow-y-auto flex-1">
              <button
                onClick={handleSwitchToAgency}
                className={`w-full text-left px-3 py-2.5 sm:py-2 rounded-md text-sm transition-colors touch-target ${
                  viewMode === 'agency'
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FiBriefcase className="w-4 h-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">Agency View</div>
                    <div className="text-xs text-gray-500">Manage all users and accounts</div>
                  </div>
                </div>
              </button>

              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="px-3 py-1.5 sm:py-1 text-xs font-semibold text-gray-500 uppercase">Subaccounts</div>
                {isLoading ? (
                  <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
                ) : customers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">No customers found</div>
                ) : (
                  <div className="max-h-48 sm:max-h-60 overflow-y-auto">
                    {customers.map((customer) => (
                      <button
                        key={customer.customer_id}
                        onClick={() => handleSwitchToSubaccount(customer.customer_id)}
                        className={`w-full text-left px-3 py-2.5 sm:py-2 rounded-md text-sm transition-colors touch-target ${
                          (selectedCustomerId === customer.customer_id || customerId === customer.customer_id) &&
                          viewMode === 'subaccount'
                            ? 'bg-primary-100 text-primary-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between min-w-0">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{customer.name || customer.customer_id}</div>
                            <div className="text-xs text-gray-500">
                              {customer.user_count} {customer.user_count === 1 ? 'user' : 'users'}
                            </div>
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

