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
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-200 hover:border-gray-300"
        aria-label="Switch view mode"
      >
        {viewMode === 'agency' ? (
          <>
            <FiBriefcase className="w-4 h-4" />
            <span className="hidden md:inline">Agency View</span>
          </>
        ) : (
          <>
            <FiUsers className="w-4 h-4" />
            <span className="hidden md:inline">
              {currentCustomer ? currentCustomer.name : 'Subaccount View'}
            </span>
          </>
        )}
        <FiChevronDown className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Switch View</h3>
          </div>
          <div className="p-2">
            <button
              onClick={handleSwitchToAgency}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                viewMode === 'agency'
                  ? 'bg-primary-100 text-primary-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <FiBriefcase className="w-4 h-4" />
                <div>
                  <div className="font-medium">Agency View</div>
                  <div className="text-xs text-gray-500">Manage all users and accounts</div>
                </div>
              </div>
            </button>

            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">Subaccounts</div>
              {isLoading ? (
                <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
              ) : customers.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">No customers found</div>
              ) : (
                <div className="max-h-60 overflow-y-auto">
                  {customers.map((customer) => (
                    <button
                      key={customer.customer_id}
                      onClick={() => handleSwitchToSubaccount(customer.customer_id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        (selectedCustomerId === customer.customer_id || customerId === customer.customer_id) &&
                        viewMode === 'subaccount'
                          ? 'bg-primary-100 text-primary-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{customer.name || customer.customer_id}</div>
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
      )}
    </div>
  )
}

