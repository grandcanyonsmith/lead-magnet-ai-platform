/**
 * Billing and usage display section
 */

'use client'

import { useState, useEffect } from 'react'
import { FiDollarSign, FiActivity, FiFileText, FiExternalLink, FiCreditCard, FiAlertCircle } from 'react-icons/fi'
import { useUsage } from '@/hooks/api/useSettings'
import { DateRangePicker } from './DateRangePicker'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { ServiceUsage } from '@/types/usage'
import { UsageCharts } from './UsageCharts'
import { ExportButton } from './ExportButton'
import { BillingClient, SubscriptionInfo } from '@/lib/api/billing.client'
import { getIdToken } from '@/lib/auth'
import { useRouter } from 'next/navigation'

export function BillingUsage() {
  const router = useRouter()
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [subscriptionLoading, setSubscriptionLoading] = useState(true)
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  // Initialize date range to current month
  useEffect(() => {
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    setStartDate(firstDayOfMonth.toISOString().split('T')[0])
    setEndDate(now.toISOString().split('T')[0])
  }, [])

  // Load subscription info
  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const token = await getIdToken()
        if (!token) return

        const billingClient = new BillingClient({
          getToken: () => token,
        })

        const subInfo = await billingClient.getSubscription()
        setSubscription(subInfo)
      } catch (err: any) {
        console.error('Failed to load subscription:', err)
        setSubscriptionError(err.message || 'Failed to load subscription')
      } finally {
        setSubscriptionLoading(false)
      }
    }

    loadSubscription()
  }, [])

  const { usage, loading, error, refetch } = useUsage(startDate, endDate)

  const handleManageSubscription = async () => {
    setPortalLoading(true)
    try {
      const token = await getIdToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const billingClient = new BillingClient({
        getToken: () => token,
      })

      const baseUrl = window.location.origin
      const { portal_url } = await billingClient.createPortalSession(
        `${baseUrl}/dashboard/settings?tab=billing`
      )

      // Redirect to Stripe Customer Portal
      window.location.href = portal_url
    } catch (err: any) {
      console.error('Failed to create portal session:', err)
      alert(err.message || 'Failed to open billing portal. Please try again.')
      setPortalLoading(false)
    }
  }

  const getSubscriptionStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'past_due':
      case 'unpaid':
        return 'bg-red-100 text-red-800'
      case 'trialing':
        return 'bg-blue-100 text-blue-800'
      case 'canceled':
      case 'no_subscription':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getSubscriptionStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active'
      case 'past_due':
        return 'Past Due'
      case 'unpaid':
        return 'Unpaid'
      case 'trialing':
        return 'Trial'
      case 'canceled':
        return 'Canceled'
      case 'no_subscription':
        return 'No Subscription'
      default:
        return status
    }
  }

  const formatServiceName = (serviceType: string): string => {
    return serviceType
      .replace(/openai_/g, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Subscription Status Header */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Billing & Usage</h3>
            <p className="text-sm text-gray-600">Track your subscription and API usage</p>
          </div>
          {subscription?.has_subscription && (
            <button
              onClick={handleManageSubscription}
              disabled={portalLoading}
              className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {portalLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Loading...
                </>
              ) : (
                <>
                  <FiCreditCard className="w-4 h-4 mr-2" />
                  Manage Subscription
                  <FiExternalLink className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          )}
        </div>

        {/* Subscription Status Card */}
        {subscriptionLoading ? (
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Loading subscription...</p>
          </div>
        ) : subscriptionError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{subscriptionError}</p>
          </div>
        ) : subscription ? (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <FiCreditCard className="w-5 h-5 text-primary-600 mr-2" />
                <span className="font-semibold text-gray-900">Subscription Status</span>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSubscriptionStatusColor(subscription.status)}`}>
                {getSubscriptionStatusLabel(subscription.status)}
              </span>
            </div>

            {!subscription.has_subscription && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                <div className="flex items-start">
                  <FiAlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900 mb-1">
                      No active subscription
                    </p>
                    <p className="text-xs text-yellow-800 mb-2">
                      Start a subscription to use Lead Magnet AI&apos;s features
                    </p>
                    <button
                      onClick={() => router.push('/setup-billing')}
                      className="text-xs bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 transition-colors"
                    >
                      Start Subscription
                    </button>
                  </div>
                </div>
              </div>
            )}

            {subscription.has_subscription && subscription.usage && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">Current Period Tokens</span>
                  <span className="font-medium text-gray-900">
                    {subscription.usage.total_tokens.toLocaleString()} tokens
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  {subscription.usage.units_1k.toLocaleString()} × 1k-token units reported to Stripe
                </p>
                <div className="flex flex-wrap items-center text-sm gap-2">
                  <span className="text-gray-600">Est. billable (2×):</span>
                  <span className="font-semibold text-gray-900">
                    ${subscription.usage.total_upcharge_cost.toFixed(2)}
                  </span>
                  <span className="text-gray-500">
                    Actual cost: ${subscription.usage.total_actual_cost.toFixed(2)}
                  </span>
                </div>

                {subscription.current_period_end && (
                  <p className="text-xs text-gray-600">
                    Current period ends: {new Date(subscription.current_period_end * 1000).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Date Range Selector */}
      <div className="mb-6 pb-6 border-b">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4">
          <div className="flex-1">
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
            />
          </div>
          {usage && (
            <div className="flex-shrink-0">
              <ExportButton usage={usage} startDate={startDate} endDate={endDate} />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading usage data..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : usage ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <FiDollarSign className="w-6 h-6 text-blue-600" />
                <span className="text-xs text-blue-600 font-medium">Upcharge</span>
              </div>
              <div className="text-2xl font-bold text-blue-900">
                ${(usage.openai?.total_upcharge || 0).toFixed(2)}
              </div>
              <div className="text-xs text-blue-600 mt-1">Total Cost</div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <FiDollarSign className="w-6 h-6 text-green-600" />
                <span className="text-xs text-green-600 font-medium">Actual</span>
              </div>
              <div className="text-2xl font-bold text-green-900">
                ${(usage.openai?.total_actual || 0).toFixed(2)}
              </div>
              <div className="text-xs text-green-600 mt-1">Before Upcharge</div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <FiActivity className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-purple-900">
                {usage.summary?.total_tokens?.toLocaleString() || 0}
              </div>
              <div className="text-xs text-purple-600 mt-1">Total Tokens</div>
            </div>

            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <FiFileText className="w-6 h-6 text-orange-600" />
              </div>
              <div className="text-2xl font-bold text-orange-900">
                {usage.summary?.total_calls || 0}
              </div>
              <div className="text-xs text-orange-600 mt-1">API Calls</div>
            </div>
          </div>

          {/* Usage Charts */}
          {usage.openai?.by_service && Object.keys(usage.openai.by_service).length > 0 && (
            <UsageCharts usage={usage} />
          )}

          {/* Breakdown Table */}
          {usage.openai?.by_service && Object.keys(usage.openai.by_service).length > 0 ? (
            <div className="overflow-x-auto -mx-6 px-6">
              <div className="block md:hidden mb-4">
                <p className="text-sm text-gray-600">Scroll horizontally to view all columns</p>
              </div>
              <table className="min-w-full divide-y divide-gray-200" role="table" aria-label="Usage breakdown by service">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Service
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Calls
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Input Tokens
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Output Tokens
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actual Cost
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Upcharge Cost
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.values(usage.openai.by_service).map((service: ServiceUsage) => (
                    <tr key={service.service_type}>
                      <th scope="row" className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatServiceName(service.service_type)}
                      </th>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {service.calls.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {service.input_tokens.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {service.output_tokens.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        ${service.actual_cost.toFixed(4)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                        ${service.upcharge_cost.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium mb-2">No usage data found</p>
              <p className="text-sm">No OpenAI API calls were recorded for the selected date range.</p>
              <p className="text-sm mt-2">
                Try generating a template, form CSS, or workflow instruction to see usage data.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p>Select a date range to view usage data</p>
        </div>
      )}
    </div>
  )
}

