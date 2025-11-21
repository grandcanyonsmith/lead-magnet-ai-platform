'use client'

import { useState } from 'react'
import { FiFolder, FiChevronDown, FiChevronRight, FiEdit, FiTrash2, FiMoreVertical } from 'react-icons/fi'
import { Folder } from '@/features/folders/types'
import { Workflow } from '@/shared/types'
import { useUpdateFolder, useDeleteFolder } from '@/features/folders/hooks/useFolders'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'

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
    try {
      await deleteFolder(folder.folder_id)
    } catch (error) {
      console.error('Failed to delete folder:', error)
    }
    setShowDeleteConfirm(false)
    setShowMenu(false)
  }

  return (
    <div className="mb-4">
      {/* Folder Header */}
      <div className="bg-white rounded-2xl shadow-soft border border-white/60 p-4 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-2xl bg-surface-100 text-ink-600 hover:text-ink-900 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            >
              {isExpanded ? (
                <FiChevronDown className="w-5 h-5" />
              ) : (
                <FiChevronRight className="w-5 h-5" />
              )}
            </button>
            
            <FiFolder className="w-5 h-5 text-brand-600 flex-shrink-0" />
            
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
                className="flex-1 px-3 py-2 text-sm font-medium border border-brand-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white/90 shadow-soft"
                autoFocus
              />
            ) : (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex-1 text-left min-w-0"
              >
                <span className="text-sm font-semibold text-ink-900 truncate">
                  {folder.folder_name}
                </span>
                <span className="text-xs text-ink-500 ml-2">
                  ({workflows.length})
                </span>
              </button>
            )}
          </div>

          {!isEditing && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 text-ink-500 hover:text-ink-900 rounded-2xl transition-colors hover:bg-surface-100"
              >
                <FiMoreVertical className="w-4 h-4" />
              </button>
              
              {showMenu && (
                <div className="absolute right-0 mt-1 w-44 bg-white rounded-2xl shadow-soft border border-white/60 z-10">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsEditing(true)
                        setShowMenu(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-ink-700 hover:bg-surface-100 flex items-center gap-2"
                    >
                      <FiEdit className="w-4 h-4" />
                      Rename
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(true)
                        setShowMenu(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <FiTrash2 className="w-4 h-4" />
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
            <div className="text-sm text-ink-500 italic p-4 text-center bg-surface-50 rounded-2xl border border-white/60">
              No workflows in this folder
            </div>
          ) : (
            workflows.map((workflow) => renderWorkflow(workflow))
          )}
        </div>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete folder?"
        description={
          <span>
            All workflows in <span className="font-semibold">{folder.folder_name}</span> will move to Uncategorized.
          </span>
        }
        confirmLabel="Delete"
        tone="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}
