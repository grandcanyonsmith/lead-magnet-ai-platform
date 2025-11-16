'use client'

import { useState, useRef, useEffect } from 'react'
import { FiFolder, FiFolderPlus, FiX } from 'react-icons/fi'
import { useFolders } from '@/features/folders/hooks/useFolders'
import { useUpdateWorkflow } from '@/features/workflows/hooks/useWorkflows'
import { Workflow } from '@/shared/types'

interface MoveToFolderMenuProps {
  workflow: Workflow
  onClose: () => void
  onMove?: () => void
}

export function MoveToFolderMenu({ workflow, onClose, onMove }: MoveToFolderMenuProps) {
  const { folders } = useFolders()
  const { updateWorkflow, loading } = useUpdateWorkflow()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleMoveToFolder = async (folderId: string | null) => {
    await updateWorkflow(workflow.workflow_id, { folder_id: folderId })
    onMove?.()
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="absolute left-full top-0 ml-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="py-1">
        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
          Move to folder
        </div>
        
        <button
          onClick={() => handleMoveToFolder(null)}
          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          disabled={loading}
        >
          <FiX className="w-4 h-4" />
          <span>Uncategorized</span>
          {!workflow.folder_id && (
            <span className="ml-auto text-primary-600">✓</span>
          )}
        </button>

        {folders.length === 0 ? (
          <div className="px-4 py-2 text-sm text-gray-500 italic">
            No folders yet
          </div>
        ) : (
          folders.map((folder) => (
            <button
              key={folder.folder_id}
              onClick={() => handleMoveToFolder(folder.folder_id)}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              disabled={loading}
            >
              <FiFolder className="w-4 h-4" />
              <span className="truncate">{folder.folder_name}</span>
              {workflow.folder_id === folder.folder_id && (
                <span className="ml-auto text-primary-600">✓</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}


