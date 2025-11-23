'use client'

import { FiInfo } from 'react-icons/fi'
import { SectionCard } from '@/shared/components/ui/SectionCard'
import { FormFormData } from '@/features/forms/hooks/useFormEdit'

interface FormBasicsSectionProps {
  formFormData: FormFormData
  workflowName: string
  onFormChange: (field: string, value: any) => void
}

export function FormBasicsSection({
  formFormData,
  workflowName,
  onFormChange,
}: FormBasicsSectionProps) {
  return (
    <SectionCard
      title="Form basics"
      description="Keep your form easy to identify and simple to share."
      icon={<FiInfo className="h-5 w-5" aria-hidden="true" />}
    >
      <div className="rounded-2xl border border-blue-100/80 bg-blue-50/70 px-4 py-3 text-sm text-blue-900">
        <p>
          <strong className="font-semibold">Heads up:</strong> this form name automatically mirrors your lead magnet name. Name, email, and phone fields are always included for you.
        </p>
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-900">
            Form name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formFormData.form_name}
            onChange={(e) => onFormChange('form_name', e.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            placeholder="Lead Magnet Form"
            maxLength={200}
            required
          />
          <p className="mt-2 text-xs text-gray-500">Automatically set to "{workflowName} Form".</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900">
            Public URL slug <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formFormData.public_slug}
            onChange={(e) =>
              onFormChange(
                'public_slug',
                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
              )
            }
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 font-mono text-sm lowercase shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            placeholder="lead-magnet-form"
            pattern="[a-z0-9-]+"
            required
          />
          <p className="mt-2 text-xs text-gray-500">
            Only lowercase letters, numbers, and hyphens are allowed.
          </p>
          {formFormData.public_slug && (
            <p className="mt-1 text-xs font-medium text-primary-600">
              Form URL:{' '}
              {typeof window !== 'undefined'
                ? `${window.location.origin}/v1/forms/${formFormData.public_slug}`
                : `/v1/forms/${formFormData.public_slug}`}
            </p>
          )}
        </div>
      </div>
    </SectionCard>
  )
}

