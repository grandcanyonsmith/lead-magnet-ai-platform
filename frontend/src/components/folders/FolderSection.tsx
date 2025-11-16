'use client'

import { useState } from 'react'
import { FiFolder, FiChevronDown, FiChevronRight, FiEdit, FiTrash2, FiMoreVertical } from 'react-icons/fi'
import { Folder } from '@/types/folder'
import { Workflow } from '@/types'
import { useUpdateFolder, useDeleteFolder } from '@/hooks/api/useFolders'

interface FolderSectionProps {
  folder: Folder
  workflows: Workflow[]
  onWorkflowClick?: (workflow: Workflow) => void
  onWorkflowEdit?: (workflow: Workflow) => void
  onWorkflowDelete?: (workflow: Workflow) => void
  renderWorkflow: (workflow: Workflow) => React.ReactNode
}

export function FolderSection({
  folder,
  workflows,
  onWorkflowClick,
  onWorkflowEdit,
  onWorkflowDelete,
  renderWorkflow,
}: FolderSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(folder.folder_name)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const { updateFolder, loading: updating } = useUpdateFolder()
  const { deleteFolder, loading: deleting } = useDeleteFolder()

  const handleSaveEdit = async () => {
    if (editName.trim() && editName !== folder.folder_name) {
      await updateFolder(folder.folder_id, { folder_name: editName.trim() })
    }
    setIsEditing(false)
  }

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete "${folder.folder_name}"? All workflows in this folder will be moved to Uncategorized.`)) {
      await deleteFolder(folder.folder_id)
      setShowDeleteConfirm(false)
      setShowMenu(false)
    }
  }

  return (
    <div className="mb-4">
      {/* Folder Header */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              {isExpanded ? (
                <FiChevronDown className="w-5 h-5" />
              ) : (
                <FiChevronRight className="w-5 h-5" />
              )}
            </button>
            
            <FiFolder className="w-5 h-5 text-blue-600 flex-shrink-0" />
            
            {isEditing ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleSaveEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveEdit()
                  } else if (e.key === 'Escape') {
                    setEditName(folder.folder_name)
                    setIsEditing(false)
                  }
                }}
                className="flex-1 px-2 py-1 text-sm font-medium border border-primary-500 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                autoFocus
              />
            ) : (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex-1 text-left min-w-0"
              >
                <span className="text-sm font-medium text-gray-900 truncate">
                  {folder.folder_name}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  ({workflows.length})
                </span>
              </button>
            )}
          </div>

          {!isEditing && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 text-gray-500 hover:text-gray-700 rounded transition-colors"
              >
                <FiMoreVertical className="w-4 h-4" />
              </button>
              
              {showMenu && (
                <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsEditing(true)
                        setShowMenu(false)
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <FiEdit className="w-3 h-3" />
                      Rename
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(true)
                        setShowMenu(false)
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <FiTrash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Workflows in Folder */}
      {isExpanded && (
        <div className="ml-4 space-y-2">
          {workflows.length === 0 ? (
            <div className="text-sm text-gray-500 italic p-4 text-center bg-gray-50 rounded-lg">
              No workflows in this folder
            </div>
          ) : (
            workflows.map((workflow) => renderWorkflow(workflow))
          )}
        </div>
      )}
    </div>
  )
}


