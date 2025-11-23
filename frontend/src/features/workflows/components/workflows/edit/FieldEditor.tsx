'use client'

import { FiChevronDown, FiChevronUp, FiMinus } from 'react-icons/fi'
import { FormField } from '@/features/forms/types'
import { getFieldTypeIcon } from '@/features/forms/utils/formUtils'

interface FieldEditorProps {
  field: FormField
  index: number
  totalFields: number
  onFieldChange: (index: number, field: string, value: any) => void
  onRemoveField: (index: number) => void
  onMoveFieldUp: (index: number) => void
  onMoveFieldDown: (index: number) => void
}

export function FieldEditor({
  field,
  index,
  totalFields,
  onFieldChange,
  onRemoveField,
  onMoveFieldUp,
  onMoveFieldDown,
}: FieldEditorProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 text-xs font-semibold text-gray-500">
            #{index + 1}
          </span>
          <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            {getFieldTypeIcon(field.field_type)}
            <span className="capitalize">{field.field_type}</span>
          </div>
          {field.required && (
            <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
              Required
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMoveFieldUp(index)}
            disabled={index === 0}
            className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:text-gray-900 disabled:cursor-not-allowed disabled:text-gray-300"
            title="Move field up"
            aria-label={`Move ${field.label || 'field'} up`}
          >
            <FiChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onMoveFieldDown(index)}
            disabled={index === totalFields - 1}
            className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:text-gray-900 disabled:cursor-not-allowed disabled:text-gray-300"
            title="Move field down"
            aria-label={`Move ${field.label || 'field'} down`}
          >
            <FiChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onRemoveField(index)}
            className="ml-1 rounded-full border border-red-100 p-2 text-red-600 transition hover:bg-red-50"
            title="Remove field"
            aria-label={`Remove ${field.label || 'field'}`}
          >
            <FiMinus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
            Field type
          </label>
          <select
            value={field.field_type}
            onChange={(e) => onFieldChange(index, 'field_type', e.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
            <option value="text">Text</option>
            <option value="email">Email</option>
            <option value="tel">Phone</option>
            <option value="textarea">Textarea</option>
            <option value="select">Select</option>
            <option value="number">Number</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
            Label
          </label>
          <input
            type="text"
            value={field.label}
            onChange={(e) => onFieldChange(index, 'label', e.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            placeholder="Field label"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
          Placeholder
        </label>
        <input
          type="text"
          value={field.placeholder || ''}
          onChange={(e) => onFieldChange(index, 'placeholder', e.target.value)}
          className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          placeholder="Placeholder text"
        />
      </div>

      {field.field_type === 'select' && (
        <div className="mt-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
            Options (comma separated)
          </label>
          <input
            type="text"
            value={field.options?.join(', ') || ''}
            onChange={(e) =>
              onFieldChange(
                index,
                'options',
                e.target.value
                  .split(',')
                  .map((option) => option.trim())
                  .filter((option) => option)
              )
            }
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            placeholder="Option 1, Option 2, Option 3"
          />
        </div>
      )}

      <label className="mt-3 flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => onFieldChange(index, 'required', e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        Required field
      </label>
    </div>
  )
}

