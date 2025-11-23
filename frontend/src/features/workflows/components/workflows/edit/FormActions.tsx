'use client'

import { FiSave } from 'react-icons/fi'

interface FormActionsProps {
  submitting: boolean
  onCancel: () => void
}

export function FormActions({ submitting, onCancel }: FormActionsProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        className="w-full rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:w-auto"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        <FiSave className="h-4 w-4" aria-hidden="true" />
        {submitting ? 'Saving...' : 'Save changes'}
      </button>
    </div>
  )
}

