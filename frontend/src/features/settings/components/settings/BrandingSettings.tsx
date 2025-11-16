/**
 * Branding settings form section
 */

'use client'

import { useState } from 'react'
import { Settings } from '@/shared/types'
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

        <div className="border-t border-gray-200 pt-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">Brand Information</h4>
          <p className="text-sm text-gray-600 mb-4">
            Provide detailed information about your brand. This will be used as context when generating lead magnets to ensure they align with your brand voice and target audience.
          </p>
          
          <div className="space-y-6">
            <FormField
              label="Industry"
              name="industry"
              type="text"
              value={settings.industry || ''}
              onChange={(value) => onChange('industry', value)}
              error={errors?.industry}
              helpText="The industry your company operates in (e.g., SaaS, E-commerce, Healthcare)"
              placeholder="SaaS"
            />

            <FormField
              label="Company Size"
              name="company_size"
              type="text"
              value={settings.company_size || ''}
              onChange={(value) => onChange('company_size', value)}
              error={errors?.company_size}
              helpText="Your company size (e.g., Startup, Small Business, Enterprise)"
              placeholder="Startup"
            />

            <FormField
              label="Brand Description"
              name="brand_description"
              type="textarea"
              value={settings.brand_description || ''}
              onChange={(value) => onChange('brand_description', value)}
              error={errors?.brand_description}
              helpText="A brief description of your brand, what you do, and what makes you unique"
              placeholder="We are a SaaS company that helps small businesses automate their workflows..."
            />

            <FormField
              label="Brand Voice"
              name="brand_voice"
              type="textarea"
              value={settings.brand_voice || ''}
              onChange={(value) => onChange('brand_voice', value)}
              error={errors?.brand_voice}
              helpText="Describe your brand's voice and tone (e.g., professional and friendly, casual and approachable, technical and precise)"
              placeholder="Professional yet approachable, with a focus on clarity and helpfulness"
            />

            <FormField
              label="Target Audience"
              name="target_audience"
              type="textarea"
              value={settings.target_audience || ''}
              onChange={(value) => onChange('target_audience', value)}
              error={errors?.target_audience}
              helpText="Describe your ideal customer profile and target audience"
              placeholder="Small business owners and entrepreneurs looking to streamline their operations..."
            />

            <FormField
              label="Company Values"
              name="company_values"
              type="textarea"
              value={settings.company_values || ''}
              onChange={(value) => onChange('company_values', value)}
              error={errors?.company_values}
              helpText="Your company's core values and principles"
              placeholder="Innovation, Customer-first, Transparency, Sustainability"
            />

            <FormField
              label="Brand Messaging Guidelines"
              name="brand_messaging_guidelines"
              type="textarea"
              value={settings.brand_messaging_guidelines || ''}
              onChange={(value) => onChange('brand_messaging_guidelines', value)}
              error={errors?.brand_messaging_guidelines}
              helpText="Guidelines for how your brand communicates, including key messaging points, do's and don'ts"
              placeholder="Always emphasize value and outcomes. Avoid technical jargon. Focus on customer success stories..."
            />
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">Ideal Customer Profile (ICP)</h4>
          <p className="text-sm text-gray-600 mb-4">
            Provide a URL to an ICP document that will be referenced when generating lead magnets. This helps ensure generated content is tailored to your ideal customer profile.
          </p>
          
          <FormField
            label="ICP Document URL"
            name="icp_document_url"
            type="url"
            value={settings.icp_document_url || ''}
            onChange={(value) => onChange('icp_document_url', value)}
            error={errors?.icp_document_url}
            helpText="URL to an ICP document (PDF, text file, or web page). The content will be fetched and used as context during lead magnet generation."
            placeholder="https://example.com/icp-document.pdf"
          />
        </div>
      </div>
    </div>
  )
}

