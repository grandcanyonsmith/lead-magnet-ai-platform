'use client'

interface RerunConfirmDialogProps {
  /** Whether the dialog is visible */
  isOpen: boolean
  /** Callback when user confirms rerun */
  onConfirm: () => void
  /** Callback when user cancels */
  onCancel: () => void
}

/**
 * Confirmation dialog for rerunning a step after editing
 * 
 * Shown after a step is successfully updated, prompting the user to rerun
 * the step with the new configuration. Includes backdrop and responsive
 * button layout.
 * 
 * Features:
 * - Modal overlay with backdrop click to cancel
 * - Responsive button layout (stacked on mobile, inline on desktop)
 * - Touch-friendly button sizes (min 44px height on mobile)
 * 
 * @param props - Dialog props
 * @returns Dialog JSX or null if not open
 */
export function RerunConfirmDialog({ isOpen, onConfirm, onCancel }: RerunConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onCancel}
        />

        {/* Modal */}
        <div className="relative z-50 w-full max-w-md bg-white rounded-lg shadow-xl mx-4">
          <div className="p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
              Step Updated Successfully
            </h3>
            <p className="text-sm text-gray-600 mb-4 sm:mb-6">
              Would you like to rerun this step with the updated configuration?
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
              <button
                onClick={onCancel}
                className="px-4 py-2.5 sm:py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors touch-target min-h-[44px] sm:min-h-0"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2.5 sm:py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors touch-target min-h-[44px] sm:min-h-0"
              >
                Rerun Step
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

