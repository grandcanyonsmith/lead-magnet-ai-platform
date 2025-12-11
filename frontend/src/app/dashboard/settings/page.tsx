'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { FiSave } from 'react-icons/fi'
import { useSettings, useUpdateSettings } from '@/hooks/api/useSettings'
import { Settings } from '@/types'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SettingsTabs, SettingsTab } from '@/components/settings/SettingsTabs'
import { GeneralSettings } from '@/components/settings/GeneralSettings'
import { BrandingSettings } from '@/components/settings/BrandingSettings'
import { DeliverySettings } from '@/components/settings/DeliverySettings'
import { BillingUsage } from '@/components/settings/BillingUsage'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [formData, setFormData] = useState<Partial<Settings>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { settings, loading, error, refetch } = useSettings()
  const { updateSettings, loading: saving } = useUpdateSettings()

  // Initialize form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        organization_name: settings.organization_name || '',
        contact_email: settings.contact_email || '',
        website_url: settings.website_url || '',
        default_ai_model: settings.default_ai_model || 'gpt-5',
        logo_url: settings.logo_url || '',
        ghl_webhook_url: settings.ghl_webhook_url || '',
        custom_domain: settings.custom_domain || '',
        lead_phone_field: settings.lead_phone_field || '',
        // Brand information fields
        brand_description: settings.brand_description || '',
        brand_voice: settings.brand_voice || '',
        target_audience: settings.target_audience || '',
        company_values: settings.company_values || '',
        industry: settings.industry || '',
        company_size: settings.company_size || '',
        brand_messaging_guidelines: settings.brand_messaging_guidelines || '',
        icp_document_url: settings.icp_document_url || '',
      })
    }
  }, [settings])

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!settings) return false
    
    return (
      formData.organization_name !== (settings.organization_name || '') ||
      formData.contact_email !== (settings.contact_email || '') ||
      formData.website_url !== (settings.website_url || '') ||
      formData.default_ai_model !== (settings.default_ai_model || 'gpt-5') ||
      formData.logo_url !== (settings.logo_url || '') ||
      formData.ghl_webhook_url !== (settings.ghl_webhook_url || '') ||
      formData.custom_domain !== (settings.custom_domain || '') ||
      formData.lead_phone_field !== (settings.lead_phone_field || '') ||
      formData.brand_description !== (settings.brand_description || '') ||
      formData.brand_voice !== (settings.brand_voice || '') ||
      formData.target_audience !== (settings.target_audience || '') ||
      formData.company_values !== (settings.company_values || '') ||
      formData.industry !== (settings.industry || '') ||
      formData.company_size !== (settings.company_size || '') ||
      formData.brand_messaging_guidelines !== (settings.brand_messaging_guidelines || '') ||
      formData.icp_document_url !== (settings.icp_document_url || '')
    )
  }, [settings, formData])

  // Warn about unsaved changes
  useUnsavedChanges({
    hasUnsavedChanges: hasUnsavedChanges && activeTab !== 'billing',
    message: 'You have unsaved changes. Are you sure you want to leave?',
  })

  const handleFieldChange = useCallback((field: keyof Settings, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }, [errors])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (formData.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
      newErrors.contact_email = 'Please enter a valid email address'
    }

    if (formData.website_url && !/^https?:\/\/.+/.test(formData.website_url)) {
      newErrors.website_url = 'Please enter a valid URL (must start with http:// or https://)'
    }

    if (formData.logo_url && !/^https?:\/\/.+/.test(formData.logo_url)) {
      newErrors.logo_url = 'Please enter a valid URL (must start with http:// or https://)'
    }

    if (formData.ghl_webhook_url && !/^https?:\/\/.+/.test(formData.ghl_webhook_url)) {
      newErrors.ghl_webhook_url = 'Please enter a valid URL (must start with http:// or https://)'
    }

    if (formData.custom_domain) {
      const value = formData.custom_domain.trim()
      const hasProtocol = /^https?:\/\//i.test(value)
      const candidate = hasProtocol ? value : `https://${value}`
      try {
        const parsed = new URL(candidate)
        if (!parsed.hostname) {
          newErrors.custom_domain = 'Please enter a valid domain'
        }
      } catch {
        newErrors.custom_domain = 'Please enter a valid domain'
      }
    }

    if (formData.icp_document_url && !/^https?:\/\/.+/.test(formData.icp_document_url)) {
      newErrors.icp_document_url = 'Please enter a valid URL (must start with http:// or https://)'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const sanitizeUrl = (value?: string) => {
    if (!value) return undefined
    try {
      const url = new URL(value.trim())
      return url.protocol === 'http:' || url.protocol === 'https:' ? value.trim() : undefined
    } catch {
      return undefined
    }
  }

  const sanitizeDomain = (value?: string) => {
    if (!value) return undefined
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    try {
      const url = new URL(candidate)
      return url.origin
    } catch {
      return undefined
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    const updatedSettings = await updateSettings({
      organization_name: formData.organization_name?.trim() || undefined,
      contact_email: formData.contact_email?.trim() || undefined,
      website_url: sanitizeUrl(formData.website_url),
      default_ai_model: formData.default_ai_model,
      logo_url: sanitizeUrl(formData.logo_url),
      ghl_webhook_url: sanitizeUrl(formData.ghl_webhook_url),
      custom_domain: sanitizeDomain(formData.custom_domain),
      lead_phone_field: formData.lead_phone_field?.trim() || undefined,
      // Brand information fields
      brand_description: formData.brand_description?.trim() || undefined,
      brand_voice: formData.brand_voice?.trim() || undefined,
      target_audience: formData.target_audience?.trim() || undefined,
      company_values: formData.company_values?.trim() || undefined,
      industry: formData.industry?.trim() || undefined,
      company_size: formData.company_size?.trim() || undefined,
      brand_messaging_guidelines: formData.brand_messaging_guidelines?.trim() || undefined,
      icp_document_url: sanitizeUrl(formData.icp_document_url),
    })

    if (updatedSettings) {
      // Refetch to get latest settings including webhook_url
      refetch()
    }
  }

  const handleSettingsUpdate = useCallback((updatedSettings: Settings) => {
    // Update local form data when settings are updated (e.g., webhook regeneration)
    setFormData((prev) => ({
      ...prev,
      webhook_url: updatedSettings.webhook_url,
    }))
    refetch()
  }, [refetch])

  if (loading) {
    return <LoadingState message="Loading settings..." fullPage />
  }

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />
  }

  if (!settings) {
    return <ErrorState message="Failed to load settings" onRetry={refetch} />
  }

  // Merge settings with form data to ensure we have the latest values
  const currentSettings: Settings = {
    ...settings,
    ...formData,
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600">Manage your account settings</p>
          </div>
          {hasUnsavedChanges && activeTab !== 'billing' && (
            <span className="px-3 py-1 text-sm font-medium text-orange-700 bg-orange-100 rounded-full">
              Unsaved changes
            </span>
          )}
        </div>
      </div>

      <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'general' && (
          <form onSubmit={handleSubmit} data-tour="settings-form">
            <GeneralSettings
              settings={currentSettings}
              onChange={handleFieldChange}
              errors={errors}
            />
            <div className="mt-6">
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
          </form>
        )}

        {activeTab === 'branding' && (
          <form onSubmit={handleSubmit}>
            <BrandingSettings
              settings={currentSettings}
              onChange={handleFieldChange}
              errors={errors}
            />
            <div className="mt-6">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiSave className="w-5 h-5 mr-2" />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'delivery' && (
          <form onSubmit={handleSubmit}>
            <DeliverySettings
              settings={currentSettings}
              onChange={handleFieldChange}
              onSettingsUpdate={handleSettingsUpdate}
              errors={errors}
            />
            <div className="mt-6">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiSave className="w-5 h-5 mr-2" />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'billing' && <BillingUsage />}
      </SettingsTabs>
    </div>
  )
}
