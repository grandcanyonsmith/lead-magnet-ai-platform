/**
 * Branding settings form section
 */

'use client'

import { useState } from 'react'
import { Settings } from '@/types'
import { FormField } from './FormField'

interface BrandingSettingsProps {
  settings: Settings
  onChange: (field: keyof Settings, value: string) => void
  errors?: Record<string, string>
}

export function BrandingSettings({ settings, onChange, errors }: BrandingSettingsProps) {
  const [imageError, setImageError] = useState(false)

  const handleImageError = () => {
    setImageError(true)
  }

  const handleImageLoad = () => {
    setImageError(false)
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Branding</h3>
        <p className="text-sm text-gray-600 mb-6">
          Customize your branding that appears on all forms and lead magnets.
        </p>
      </div>

      <div className="space-y-6">
        <FormField
          label={
            <>
              Logo URL
              <span className="ml-2 text-xs text-gray-500" title="Logo URL that will appear on all forms">
                ℹ️
              </span>
            </>
          }
          name="logo_url"
          type="url"
          value={settings.logo_url || ''}
          onChange={(value) => onChange('logo_url', value)}
          error={errors?.logo_url}
          helpText="Logo URL that will appear on all forms. Use a direct image URL (e.g., from Cloudinary, S3, or your CDN)."
          placeholder="https://example.com/logo.png"
        />

        {settings.logo_url && !imageError && (
          <div className="mt-3">
            <p className="text-sm text-gray-600 mb-2">Preview:</p>
            <img
              src={settings.logo_url}
              alt="Logo preview"
              className="max-h-20 max-w-xs border border-gray-200 rounded"
              onError={handleImageError}
              onLoad={handleImageLoad}
            />
          </div>
        )}

        {imageError && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">
              Failed to load image. Please check that the URL is correct and the image is publicly accessible.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

