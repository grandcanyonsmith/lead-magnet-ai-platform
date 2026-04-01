import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { FolderIcon } from "@heroicons/react/24/outline";
import { Folder } from "@/types";

interface FolderModalsProps {
  showCreateFolderModal: boolean;
  setShowCreateFolderModal: (show: boolean) => void;
  showMoveFolderModal: string | null;
  setShowMoveFolderModal: (id: string | null) => void;
  newFolderName: string;
  setNewFolderName: (name: string) => void;
  handleCreateFolder: () => void;
  handleMoveToFolder: (workflowId: string, folderId: string | null) => void;
  folders: Folder[];
  folderActionLoading: boolean;
}

export function FolderModals({
  showCreateFolderModal,
  setShowCreateFolderModal,
  showMoveFolderModal,
  setShowMoveFolderModal,
  newFolderName,
  setNewFolderName,
  handleCreateFolder,
  handleMoveToFolder,
  folders,
  folderActionLoading,
}: FolderModalsProps) {
  return (
    <>
      {/* Create Folder Modal */}
      <Dialog
        open={showCreateFolderModal}
        onOpenChange={setShowCreateFolderModal}
      >
        <DialogContent className="max-w-md overflow-hidden rounded-2xl p-6 sm:rounded-2xl">
          <DialogHeader className="space-y-0 text-left">
            <DialogTitle className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
              Create New Folder
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
              }}
              placeholder="Folder name (e.g., Marketing, Sales)"
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              autoFocus
            />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              className="inline-flex justify-center rounded-lg border border-transparent bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              onClick={() => setShowCreateFolderModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex justify-center rounded-lg border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || folderActionLoading}
            >
              {folderActionLoading ? "Creating..." : "Create Folder"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Move to Folder Modal */}
      <Dialog
        open={!!showMoveFolderModal}
        onOpenChange={(open) => {
          if (!open) setShowMoveFolderModal(null);
        }}
      >
        <DialogContent className="max-w-md overflow-hidden rounded-2xl p-6 sm:rounded-2xl">
          <DialogHeader className="space-y-0 text-left">
            <DialogTitle className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
              Move to Folder
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
            <button
              onClick={() =>
                showMoveFolderModal &&
                handleMoveToFolder(showMoveFolderModal, null)
              }
              className="group flex w-full items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <FolderIcon className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Root (No folder)
              </span>
            </button>
            {folders.map((folder) => (
              <button
                key={folder.folder_id}
                onClick={() =>
                  showMoveFolderModal &&
                  handleMoveToFolder(showMoveFolderModal, folder.folder_id)
                }
                className="group flex w-full items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <FolderIcon className="h-5 w-5 text-primary-200 group-hover:text-primary-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {folder.folder_name}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
