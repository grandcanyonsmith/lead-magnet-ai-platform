'use client'

import { FiEye } from 'react-icons/fi'
import { SectionCard } from '@/shared/components/ui/SectionCard'
import { FormFormData } from '@/features/forms/hooks/useFormEdit'
import { FormPreview } from './FormPreview'
import { FormBasicsSection } from './FormBasicsSection'
import { FormFieldsSection } from './FormFieldsSection'
import { SecurityLimitsSection } from './SecurityLimitsSection'
import { ConfirmationStylingSection } from './ConfirmationStylingSection'
import { FormActions } from './FormActions'

interface FormTabProps {
  formFormData: FormFormData
  workflowName: string
  submitting: boolean
  onFormChange: (field: string, value: any) => void
  onFieldChange: (index: number, field: string, value: any) => void
  onAddField: () => void
  onRemoveField: (index: number) => void
  onMoveFieldUp: (index: number) => void
  onMoveFieldDown: (index: number) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

export function FormTab({
  formFormData,
  workflowName,
  submitting,
  onFormChange,
  onFieldChange,
  onAddField,
  onRemoveField,
  onMoveFieldUp,
  onMoveFieldDown,
  onSubmit,
  onCancel,
}: FormTabProps) {
  const customFields = formFormData.form_fields_schema.fields

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <form onSubmit={onSubmit} className="order-2 space-y-6 lg:order-1">
        <FormBasicsSection
          formFormData={formFormData}
          workflowName={workflowName}
          onFormChange={onFormChange}
        />

        <FormFieldsSection
          customFields={customFields}
          onAddField={onAddField}
          onFieldChange={onFieldChange}
          onRemoveField={onRemoveField}
          onMoveFieldUp={onMoveFieldUp}
          onMoveFieldDown={onMoveFieldDown}
        />

        <SecurityLimitsSection
          formFormData={formFormData}
          onFormChange={onFormChange}
        />

        <ConfirmationStylingSection
          formFormData={formFormData}
          onFormChange={onFormChange}
        />

        <FormActions
          submitting={submitting}
          onCancel={onCancel}
        />
      </form>

      <div className="order-1 lg:order-2">
        <div className="sticky top-6">
          <SectionCard
            title="Live preview"
            description="See exactly what visitors will experience."
            icon={<FiEye className="h-5 w-5" aria-hidden="true" />}
            stickyHeader
          >
            <div className="rounded-2xl border border-gray-100 bg-white">
              <FormPreview formFormData={formFormData} />
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
