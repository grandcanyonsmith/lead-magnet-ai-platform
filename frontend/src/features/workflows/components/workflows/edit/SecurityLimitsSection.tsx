'use client'

import { FiShield } from 'react-icons/fi'
import { SectionCard } from '@/shared/components/ui/SectionCard'
import { FormFormData } from '@/features/forms/hooks/useFormEdit'

interface SecurityLimitsSectionProps {
  formFormData: FormFormData
  onFormChange: (field: string, value: any) => void
}

export function SecurityLimitsSection({
  formFormData,
  onFormChange,
}: SecurityLimitsSectionProps) {
  return (
    <SectionCard
      title="Security & limits"
      description="Prevent spam and control submission flow."
      icon={<FiShield className="h-5 w-5" aria-hidden="true" />}
    >
      <div className="space-y-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={formFormData.rate_limit_enabled}
            onChange={(e) => onFormChange('rate_limit_enabled', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm font-medium text-gray-900">Enable rate limiting</span>
        </label>

        {formFormData.rate_limit_enabled && (
          <div>
            <label className="block text-sm font-medium text-gray-900">
              Submissions per hour
            </label>
            <input
              type="number"
              value={formFormData.rate_limit_per_hour}
              onChange={(e) =>
                onFormChange('rate_limit_per_hour', parseInt(e.target.value, 10) || 10)
              }
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              min={1}
              max={1000}
            />
          </div>
        )}

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={formFormData.captcha_enabled}
            onChange={(e) => onFormChange('captcha_enabled', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm font-medium text-gray-900">Enable CAPTCHA</span>
        </label>
      </div>
    </SectionCard>
  )
}

