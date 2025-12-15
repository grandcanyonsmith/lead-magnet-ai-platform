/**
 * General settings form section
 */

'use client'

import { Settings } from '@/types'
import { FormField } from './FormField'

interface GeneralSettingsProps {
  settings: Settings
  onChange: (field: keyof Settings, value: string) => void
  errors?: Record<string, string>
}

const AI_MODEL_OPTIONS = [
  { value: 'gpt-5.1-codex', label: 'GPT-5.1 Codex' },
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'computer-use-preview', label: 'Computer Use Preview' },
  { value: 'o4-mini-deep-research', label: 'O4-Mini-Deep-Research' },
]

export function GeneralSettings({ settings, onChange, errors }: GeneralSettingsProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">General Information</h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure your organization details and default AI model preferences.
        </p>
      </div>

      <div className="space-y-6">
        <FormField
          label="Organization Name"
          name="organization_name"
          type="text"
          value={settings.organization_name || ''}
          onChange={(value) => onChange('organization_name', value)}
          error={errors?.organization_name}
          dataTour="organization-name"
        />

        <FormField
          label="Contact Email"
          name="contact_email"
          type="email"
          value={settings.contact_email || ''}
          onChange={(value) => onChange('contact_email', value)}
          error={errors?.contact_email}
          helpText="Email address for notifications and support"
          dataTour="contact-email"
        />

        <FormField
          label="Website URL"
          name="website_url"
          type="url"
          value={settings.website_url || ''}
          onChange={(value) => onChange('website_url', value)}
          error={errors?.website_url}
          helpText="Your organization's website URL"
        />

        <FormField
          label="Default AI Model"
          name="default_ai_model"
          type="text"
          value={settings.default_ai_model || 'gpt-5.1-codex'}
          onChange={(value) => onChange('default_ai_model', value)}
          options={AI_MODEL_OPTIONS}
          helpText="Default AI model used for generating lead magnets"
        />
      </div>
    </div>
  )
}

