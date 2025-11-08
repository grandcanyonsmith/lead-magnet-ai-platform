'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { FiSave, FiDollarSign, FiActivity, FiTrendingUp, FiFileText } from 'react-icons/fi'

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  
  // Billing & Usage state
  const [usageData, setUsageData] = useState<any>(null)
  const [loadingUsage, setLoadingUsage] = useState(false)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  const loadUsage = useCallback(async () => {
    if (!startDate || !endDate) return
    
    setLoadingUsage(true)
    try {
      console.log('[Billing] Loading usage data', { startDate, endDate })
      const data = await api.getUsage(startDate, endDate)
      console.log('[Billing] Usage data received', data)
      setUsageData(data)
    } catch (error: any) {
      console.error('Failed to load usage:', error)
      // Set empty data structure so UI can show "no data" message
      setUsageData({
        openai: {
          by_service: {},
          total_actual: 0,
          total_upcharge: 0,
        },
        summary: {
          total_calls: 0,
          total_tokens: 0,
          total_input_tokens: 0,
          total_output_tokens: 0,
        },
      })
    } finally {
      setLoadingUsage(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    loadSettings()
    initializeDateRange()
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      loadUsage()
    }
  }, [startDate, endDate, loadUsage])

  const initializeDateRange = () => {
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    setStartDate(firstDayOfMonth.toISOString().split('T')[0])
    setEndDate(now.toISOString().split('T')[0])
  }

  const loadSettings = async () => {
    try {
      const data = await api.getSettings()
      setSettings(data)
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSuccess(false)

    try {
      await api.updateSettings(settings)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading settings...</div>
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your account settings</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl" data-tour="settings-form">
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            Settings saved successfully!
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Organization Name
            </label>
            <input
              type="text"
              value={settings.organization_name || ''}
              onChange={(e) => setSettings({ ...settings, organization_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              data-tour="organization-name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Email
            </label>
            <input
              type="email"
              value={settings.contact_email || ''}
              onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              data-tour="contact-email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Website URL
            </label>
            <input
              type="url"
              value={settings.website_url || ''}
              onChange={(e) => setSettings({ ...settings, website_url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default AI Model
            </label>
            <select
              value={settings.default_ai_model || 'gpt-5'}
              onChange={(e) => setSettings({ ...settings, default_ai_model: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="gpt-5">GPT-5</option>
              <option value="gpt-4.1">GPT-4.1</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            </select>
          </div>

          <div className="pt-4 border-t">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Branding</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo URL
                  <span className="ml-2 text-xs text-gray-500" title="Logo URL that will appear on all forms">
                    ℹ️
                  </span>
                </label>
                <input
                  type="url"
                  value={settings.logo_url || ''}
                  onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="https://example.com/logo.png"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Logo URL that will appear on all forms. Use a direct image URL (e.g., from Cloudinary, S3, or your CDN).
                </p>
                {settings.logo_url && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-600 mb-2">Preview:</p>
                    <img
                      src={settings.logo_url}
                      alt="Logo preview"
                      className="max-h-20 max-w-xs border border-gray-200 rounded"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Settings</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GHL Webhook URL
                  <span className="ml-2 text-xs text-gray-500" title="Your GoHighLevel webhook endpoint for SMS/Email delivery">
                    ℹ️
                  </span>
                </label>
                <input
                  type="url"
                  value={settings.ghl_webhook_url || ''}
                  onChange={(e) => setSettings({ ...settings, ghl_webhook_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="https://api.gohighlevel.com/webhook/..."
                />
                <p className="mt-1 text-sm text-gray-500">
                  Your GoHighLevel webhook endpoint for SMS/Email delivery
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lead Phone Number Field
                </label>
                <input
                  type="text"
                  value={settings.lead_phone_field || ''}
                  onChange={(e) => setSettings({ ...settings, lead_phone_field: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="phone"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Phone number field name from your form (e.g., &quot;phone&quot; or &quot;phone_number&quot;)
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-tour="save-settings"
            >
              <FiSave className="w-5 h-5 mr-2" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </form>

      {/* Billing & Usage Section */}
      <div className="mt-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Billing & Usage</h2>
          <p className="text-gray-600">Track your OpenAI API usage and costs</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          {/* Date Range Selector */}
          <div className="mb-6 pb-6 border-b">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <button
                  onClick={() => {
                    const now = new Date()
                    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
                    setStartDate(firstDayOfMonth.toISOString().split('T')[0])
                    setEndDate(now.toISOString().split('T')[0])
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Current Month
                </button>
              </div>
            </div>
          </div>

          {loadingUsage ? (
            <div className="text-center py-12">Loading usage data...</div>
          ) : usageData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <FiDollarSign className="w-6 h-6 text-blue-600" />
                    <span className="text-xs text-blue-600 font-medium">Upcharge</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-900">
                    ${(usageData.openai?.total_upcharge || 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">Total Cost</div>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <FiDollarSign className="w-6 h-6 text-green-600" />
                    <span className="text-xs text-green-600 font-medium">Actual</span>
                  </div>
                  <div className="text-2xl font-bold text-green-900">
                    ${(usageData.openai?.total_actual || 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-green-600 mt-1">Before Upcharge</div>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <FiActivity className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="text-2xl font-bold text-purple-900">
                    {usageData.summary?.total_tokens?.toLocaleString() || 0}
                  </div>
                  <div className="text-xs text-purple-600 mt-1">Total Tokens</div>
                </div>

                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <FiFileText className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="text-2xl font-bold text-orange-900">
                    {usageData.summary?.total_calls || 0}
                  </div>
                  <div className="text-xs text-orange-600 mt-1">API Calls</div>
                </div>
              </div>

              {/* Breakdown Table */}
              {usageData.openai?.by_service && Object.keys(usageData.openai.by_service).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Service
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Calls
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Input Tokens
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Output Tokens
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actual Cost
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Upcharge Cost
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Object.values(usageData.openai.by_service).map((service: any) => (
                        <tr key={service.service_type}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {service.service_type.replace(/openai_/g, '').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </td>
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
                  <p className="text-sm mt-2">Try generating a template, form CSS, or workflow instruction to see usage data.</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p>Select a date range to view usage data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

