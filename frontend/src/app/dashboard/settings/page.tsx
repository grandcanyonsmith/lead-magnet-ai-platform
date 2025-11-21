'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { FiSave } from 'react-icons/fi'
import { useSettings, useUpdateSettings } from '@/features/settings/hooks/useSettings'
import { Settings } from '@/shared/types'
import { LoadingState } from '@/shared/components/ui/LoadingState'
import { ErrorState } from '@/shared/components/ui/ErrorState'
import { GeneralSettings } from '@/features/settings/components/settings/GeneralSettings'
import { BrandingSettings } from '@/features/settings/components/settings/BrandingSettings'
import { DeliverySettings } from '@/features/settings/components/settings/DeliverySettings'
import { BillingUsage } from '@/features/settings/components/settings/BillingUsage'
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges'

export default function SettingsPage() {
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
  const { UnsavedChangesDialog } = useUnsavedChanges({
    hasUnsavedChanges: hasUnsavedChanges,
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

    if (formData.icp_document_url && !/^https?:\/\/.+/.test(formData.icp_document_url)) {
      newErrors.icp_document_url = 'Please enter a valid URL (must start with http:// or https://)'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    const updatedSettings = await updateSettings({
      organization_name: formData.organization_name,
      contact_email: formData.contact_email,
      website_url: formData.website_url,
      default_ai_model: formData.default_ai_model,
      logo_url: formData.logo_url,
      ghl_webhook_url: formData.ghl_webhook_url,
      lead_phone_field: formData.lead_phone_field,
      // Brand information fields
      brand_description: formData.brand_description,
      brand_voice: formData.brand_voice,
      target_audience: formData.target_audience,
      company_values: formData.company_values,
      industry: formData.industry,
      company_size: formData.company_size,
      brand_messaging_guidelines: formData.brand_messaging_guidelines,
      icp_document_url: formData.icp_document_url,
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
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Settings</h1>
          </div>
          {hasUnsavedChanges && (
            <span className="px-3 py-1 text-sm font-medium text-amber-800 bg-amber-100 border border-amber-200 rounded-full">
              Unsaved changes
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <GeneralSettings
          settings={currentSettings}
          onChange={handleFieldChange}
          errors={errors}
        />
        
        <BrandingSettings
          settings={currentSettings}
          onChange={handleFieldChange}
          errors={errors}
        />
        
        <DeliverySettings
          settings={currentSettings}
          onChange={handleFieldChange}
          onSettingsUpdate={handleSettingsUpdate}
          errors={errors}
        />
        
        <BillingUsage />

        <div className="pt-6 border-t border-white/60">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center px-6 py-2.5 bg-brand-600 text-white rounded-2xl hover:bg-brand-700 transition-colors shadow-soft disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiSave className="w-5 h-5 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
      {UnsavedChangesDialog}
    </div>
  )
}
