'use client'

import { FiPlus, FiSettings } from 'react-icons/fi'
import { SectionCard } from '@/shared/components/ui/SectionCard'
import { FormField } from '@/features/forms/types'
import { FieldEditor } from './FieldEditor'

interface FormFieldsSectionProps {
  customFields: FormField[]
  onAddField: () => void
  onFieldChange: (index: number, field: string, value: any) => void
  onRemoveField: (index: number) => void
  onMoveFieldUp: (index: number) => void
  onMoveFieldDown: (index: number) => void
}

export function FormFieldsSection({
  customFields,
  onAddField,
  onFieldChange,
  onRemoveField,
  onMoveFieldUp,
  onMoveFieldDown,
}: FormFieldsSectionProps) {
  return (
    <SectionCard
      title="Form fields"
      description="Collect only the information that matters."
      icon={<FiSettings className="h-5 w-5" aria-hidden="true" />}
      actions={
        <button
          type="button"
          onClick={onAddField}
          className="inline-flex items-center gap-2 rounded-full border border-primary-600 px-4 py-2 text-sm font-semibold text-primary-700 transition hover:bg-primary-600 hover:text-white"
        >
          <FiPlus className="h-4 w-4" aria-hidden="true" />
          Add field
        </button>
      }
    >
      <p className="text-sm text-gray-500">
        Name, email, and phone are already in place. Add custom fields below or reorder them to fine tune your lead capture.
      </p>

      <div className="mt-4 space-y-3">
        {customFields.map((field, index) => (
          <FieldEditor
            key={field.field_id || index}
            field={field}
            index={index}
            totalFields={customFields.length}
            onFieldChange={onFieldChange}
            onRemoveField={onRemoveField}
            onMoveFieldUp={onMoveFieldUp}
            onMoveFieldDown={onMoveFieldDown}
          />
        ))}

        {customFields.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 px-4 py-10 text-center">
            <p className="text-sm text-gray-600">
              No custom fields yet. Your default contact fields are ready to go.
            </p>
            <button
              type="button"
              onClick={onAddField}
              className="mt-4 text-sm font-semibold text-primary-600 transition hover:text-primary-800"
            >
              Add your first field
            </button>
          </div>
        )}
      </div>
    </SectionCard>
  )
}

