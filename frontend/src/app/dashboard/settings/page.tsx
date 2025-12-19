'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { CheckIcon, CloudArrowUpIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
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
import clsx from 'clsx'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [formData, setFormData] = useState<Partial<Settings>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const initializedRef = useRef(false)
  const lastSavedRef = useRef<Partial<Settings>>({})

  const { settings, loading, error, refetch } = useSettings()
  const { updateSettings, loading: saving } = useUpdateSettings()

  // Initialize form data when settings first load (only once)
  useEffect(() => {
    if (settings && !initializedRef.current) {
      const initialFormData = {
        organization_name: settings.organization_name || '',
        contact_email: settings.contact_email || '',
        website_url: settings.website_url || '',
        default_ai_model: settings.default_ai_model || 'gpt-5.1-codex',
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
      }
      setFormData(initialFormData)
      lastSavedRef.current = initialFormData
      initializedRef.current = true
    } else if (settings && initializedRef.current && Object.keys(lastSavedRef.current).length === 0) {
      // If settings updated after initial load but lastSavedRef is empty, update it
      lastSavedRef.current = {
        organization_name: settings.organization_name || '',
        contact_email: settings.contact_email || '',
        website_url: settings.website_url || '',
        default_ai_model: settings.default_ai_model || 'gpt-5.1-codex',
        logo_url: settings.logo_url || '',
        ghl_webhook_url: settings.ghl_webhook_url || '',
        custom_domain: settings.custom_domain || '',
        lead_phone_field: settings.lead_phone_field || '',
        brand_description: settings.brand_description || '',
        brand_voice: settings.brand_voice || '',
        target_audience: settings.target_audience || '',
        company_values: settings.company_values || '',
        industry: settings.industry || '',
        company_size: settings.company_size || '',
        brand_messaging_guidelines: settings.brand_messaging_guidelines || '',
        icp_document_url: settings.icp_document_url || '',
      }
    }
  }, [settings])

  // Normalize domain for comparison
  const normalizeDomain = (domain?: string): string => {
    if (!domain) return ''
    const trimmed = domain.trim()
    if (!trimmed) return ''
    try {
      const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
      return url.origin
    } catch {
      return trimmed
    }
  }

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!settings) return false
    const compareTo = Object.keys(lastSavedRef.current).length > 0 ? lastSavedRef.current : settings
    const formDomain = normalizeDomain(formData.custom_domain)
    const compareDomain = normalizeDomain(compareTo.custom_domain)
    
    return (
      formData.organization_name !== (compareTo.organization_name || '') ||
      formData.contact_email !== (compareTo.contact_email || '') ||
      formData.website_url !== (compareTo.website_url || '') ||
      formData.default_ai_model !== (compareTo.default_ai_model || 'gpt-5.1-codex') ||
      formData.logo_url !== (compareTo.logo_url || '') ||
      formData.ghl_webhook_url !== (compareTo.ghl_webhook_url || '') ||
      formDomain !== compareDomain ||
      formData.lead_phone_field !== (compareTo.lead_phone_field || '') ||
      formData.brand_description !== (compareTo.brand_description || '') ||
      formData.brand_voice !== (compareTo.brand_voice || '') ||
      formData.target_audience !== (compareTo.target_audience || '') ||
      formData.company_values !== (compareTo.company_values || '') ||
      formData.industry !== (compareTo.industry || '') ||
      formData.company_size !== (compareTo.company_size || '') ||
      formData.brand_messaging_guidelines !== (compareTo.brand_messaging_guidelines || '') ||
      formData.icp_document_url !== (compareTo.icp_document_url || '')
    )
  }, [settings, formData])

  // Warn about unsaved changes
  useUnsavedChanges({
    hasUnsavedChanges: hasUnsavedChanges && activeTab !== 'billing',
    message: 'You have unsaved changes. Are you sure you want to leave?',
  })

  const handleFieldChange = useCallback((field: keyof Settings, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
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
    if (!validateForm()) return

    const settingsPayload = {
      organization_name: formData.organization_name?.trim() || undefined,
      contact_email: formData.contact_email?.trim() || undefined,
      website_url: sanitizeUrl(formData.website_url),
      default_ai_model: formData.default_ai_model,
      logo_url: sanitizeUrl(formData.logo_url),
      ghl_webhook_url: sanitizeUrl(formData.ghl_webhook_url),
      custom_domain: sanitizeDomain(formData.custom_domain),
      lead_phone_field: formData.lead_phone_field?.trim() || undefined,
      brand_description: formData.brand_description?.trim() || undefined,
      brand_voice: formData.brand_voice?.trim() || undefined,
      target_audience: formData.target_audience?.trim() || undefined,
      company_values: formData.company_values?.trim() || undefined,
      industry: formData.industry?.trim() || undefined,
      company_size: formData.company_size?.trim() || undefined,
      brand_messaging_guidelines: formData.brand_messaging_guidelines?.trim() || undefined,
      icp_document_url: sanitizeUrl(formData.icp_document_url),
    }

    const updatedSettings = await updateSettings(settingsPayload)
    if (updatedSettings) {
      const savedFormData = {
        organization_name: settingsPayload.organization_name || '',
        contact_email: settingsPayload.contact_email || '',
        website_url: settingsPayload.website_url || '',
        default_ai_model: settingsPayload.default_ai_model || 'gpt-5.1-codex',
        logo_url: settingsPayload.logo_url || '',
        ghl_webhook_url: settingsPayload.ghl_webhook_url || '',
        custom_domain: settingsPayload.custom_domain || '',
        lead_phone_field: settingsPayload.lead_phone_field || '',
        brand_description: settingsPayload.brand_description || '',
        brand_voice: settingsPayload.brand_voice || '',
        target_audience: settingsPayload.target_audience || '',
        company_values: settingsPayload.company_values || '',
        industry: settingsPayload.industry || '',
        company_size: settingsPayload.company_size || '',
        brand_messaging_guidelines: settingsPayload.brand_messaging_guidelines || '',
        icp_document_url: settingsPayload.icp_document_url || '',
      }
      setFormData((prev) => ({ ...prev, ...savedFormData }))
      lastSavedRef.current = savedFormData
      refetch()
    }
  }

  const handleSettingsUpdate = useCallback((updatedSettings: Settings) => {
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

  const currentSettings: Settings = {
    ...settings,
    ...formData,
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Settings</h1>
            <p className="mt-1 text-sm text-gray-500">Configure your organization, brand identity, and delivery preferences.</p>
          </div>
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && activeTab !== 'billing' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-100 animate-in fade-in duration-300">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500 mr-1.5 animate-pulse" />
                Unsaved changes
              </span>
            )}
          </div>
        </div>
      </div>

      <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab}>
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {activeTab === 'general' && (
            <form onSubmit={handleSubmit} data-tour="settings-form" className="space-y-8">
              <GeneralSettings
                settings={currentSettings}
                onChange={handleFieldChange}
                errors={errors}
              />
              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={saving || !hasUnsavedChanges}
                  className={clsx(
                    "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500",
                    saving || !hasUnsavedChanges
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-primary-600 text-white hover:bg-primary-700"
                  )}
                  data-tour="save-settings"
                >
                  {saving ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      Saving changes...
                    </>
                  ) : (
                    <>
                      <CloudArrowUpIcon className="h-4 w-4" />
                      Save Settings
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'branding' && (
            <form onSubmit={handleSubmit} className="space-y-8">
              <BrandingSettings
                settings={currentSettings}
                onChange={handleFieldChange}
                errors={errors}
              />
              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={saving || !hasUnsavedChanges}
                  className={clsx(
                    "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500",
                    saving || !hasUnsavedChanges
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-primary-600 text-white hover:bg-primary-700"
                  )}
                >
                  {saving ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      Saving changes...
                    </>
                  ) : (
                    <>
                      <CloudArrowUpIcon className="h-4 w-4" />
                      Save Settings
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'delivery' && (
            <form onSubmit={handleSubmit} className="space-y-8">
              <DeliverySettings
                settings={currentSettings}
                onChange={handleFieldChange}
                onSettingsUpdate={handleSettingsUpdate}
                errors={errors}
              />
              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={saving || !hasUnsavedChanges}
                  className={clsx(
                    "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500",
                    saving || !hasUnsavedChanges
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-primary-600 text-white hover:bg-primary-700"
                  )}
                >
                  {saving ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      Saving changes...
                    </>
                  ) : (
                    <>
                      <CloudArrowUpIcon className="h-4 w-4" />
                      Save Settings
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'billing' && <BillingUsage />}
        </div>
      </SettingsTabs>
    </div>
  )
}
