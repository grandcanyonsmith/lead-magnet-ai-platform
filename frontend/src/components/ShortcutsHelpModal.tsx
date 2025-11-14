'use client'

import React from 'react'
import { FiX, FiCommand } from 'react-icons/fi'

interface ShortcutsHelpModalProps {
  isOpen: boolean
  onClose: () => void
}

export const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const modKey = isMac ? '⌘' : 'Ctrl'

  const shortcuts = [
    { keys: [`${modKey}K`], description: 'Open search' },
    { keys: [`${modKey}/`], description: 'Show keyboard shortcuts' },
    { keys: ['1', '2', '3', '4', '5'], description: 'Navigate to sidebar items' },
    { keys: ['Esc'], description: 'Close modals or sidebar' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-lg shadow-2xl border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
              <FiCommand className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Keyboard Shortcuts</h2>
              <p className="text-sm text-gray-500">Speed up your workflow</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="p-6">
          <div className="space-y-4">
            {shortcuts.map((shortcut, index) => (
              <div key={index} className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600">{shortcut.description}</span>
                <div className="flex items-center gap-1.5">
                  {shortcut.keys.map((key, keyIndex) => (
                    <React.Fragment key={keyIndex}>
                      <kbd className="px-2 py-1 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded">
                        {key}
                      </kbd>
                      {keyIndex < shortcut.keys.length - 1 && (
                        <span className="text-gray-400">+</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <p className="text-xs text-gray-500 text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  )
}

