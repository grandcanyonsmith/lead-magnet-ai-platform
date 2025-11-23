'use client'

import { FiSettings } from 'react-icons/fi'
import { SectionCard } from '@/shared/components/ui/SectionCard'
import { FormFormData } from '@/features/forms/hooks/useFormEdit'

interface ConfirmationStylingSectionProps {
  formFormData: FormFormData
  onFormChange: (field: string, value: any) => void
}

export function ConfirmationStylingSection({
  formFormData,
  onFormChange,
}: ConfirmationStylingSectionProps) {
  return (
    <SectionCard
      title="Confirmation & styling"
      description="Polish the experience after someone submits the form."
      icon={<FiSettings className="h-5 w-5" aria-hidden="true" />}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-900">
            Thank you message
          </label>
          <textarea
            value={formFormData.thank_you_message}
            onChange={(e) => onFormChange('thank_you_message', e.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            placeholder="Thank you! Your submission is being processed."
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900">
            Redirect URL (optional)
          </label>
          <input
            type="url"
            value={formFormData.redirect_url}
            onChange={(e) => onFormChange('redirect_url', e.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            placeholder="https://example.com/thank-you"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900">
            Custom CSS (optional)
          </label>
          <textarea
            value={formFormData.custom_css}
            onChange={(e) => onFormChange('custom_css', e.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 font-mono text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            placeholder="/* Custom CSS styles */"
            rows={6}
          />
        </div>
      </div>
    </SectionCard>
  )
}

