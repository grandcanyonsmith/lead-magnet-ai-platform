'use client'

import { ReactNode } from 'react'

type Tone = 'default' | 'danger'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: Tone
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Brand-styled confirmation dialog used in place of native confirm/alert.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  const confirmClasses =
    tone === 'danger'
      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
      : 'bg-brand-600 hover:bg-brand-700 focus:ring-brand-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      <div
        className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-soft border border-white/60 p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 id="confirm-dialog-title" className="text-lg font-semibold text-ink-900">
              {title}
            </h3>
            {description && <div className="text-sm text-ink-600">{description}</div>}
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto px-4 py-3 sm:py-2.5 rounded-2xl border border-white/60 bg-white text-ink-700 hover:bg-surface-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 touch-target"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`w-full sm:w-auto px-4 py-3 sm:py-2.5 rounded-2xl text-white ${confirmClasses} transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 touch-target disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {loading ? 'Working...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
