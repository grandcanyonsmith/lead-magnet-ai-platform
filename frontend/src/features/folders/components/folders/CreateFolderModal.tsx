'use client'

import { useState } from 'react'
import { FiX, FiFolder } from 'react-icons/fi'
import { useCreateFolder } from '@/features/folders/hooks/useFolders'

interface CreateFolderModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function CreateFolderModal({ isOpen, onClose, onSuccess }: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState('')
  const { createFolder, loading } = useCreateFolder()

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!folderName.trim()) {
      return
    }

    const result = await createFolder({ folder_name: folderName.trim() })
    if (result) {
      setFolderName('')
      onSuccess?.()
      onClose()
    }
  }

  const handleClose = () => {
    if (!loading) {
      setFolderName('')
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            <FiX className="w-5 h-5" />
          </button>

          {/* Icon */}
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-blue-100 rounded-full">
            <FiFolder className="w-6 h-6 text-blue-600" />
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
                Create Folder
              </h3>
              <p className="text-sm text-gray-600 text-center mb-4">
                Organize your lead magnets into folders for better management
              </p>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Folder Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., Marketing Campaigns"
                  maxLength={200}
                  required
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !folderName.trim()}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Folder'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}


