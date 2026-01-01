import React, { Fragment } from "react";
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import { FolderIcon, XMarkIcon } from "@heroicons/react/24/outline";
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
      <Transition appear show={showCreateFolderModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[100]"
          onClose={() => setShowCreateFolderModal(false)}
        >
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-card p-6 text-left align-middle shadow-xl transition-all">
                  <DialogTitle
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 dark:text-white flex items-center justify-between"
                  >
                    Create New Folder
                    <button
                      onClick={() => setShowCreateFolderModal(false)}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </DialogTitle>
                  <div className="mt-4">
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateFolder();
                      }}
                      placeholder="Folder name (e.g., Marketing, Sales)"
                      className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      autoFocus
                    />
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-lg border border-transparent bg-gray-100 dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                      onClick={() => setShowCreateFolderModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-lg border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleCreateFolder}
                      disabled={!newFolderName.trim() || folderActionLoading}
                    >
                      {folderActionLoading ? "Creating..." : "Create Folder"}
                    </button>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Move to Folder Modal */}
      <Transition appear show={!!showMoveFolderModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[100]"
          onClose={() => setShowMoveFolderModal(null)}
        >
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-card p-6 text-left align-middle shadow-xl transition-all">
                  <DialogTitle
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 dark:text-white flex items-center justify-between"
                  >
                    Move to Folder
                    <button
                      onClick={() => setShowMoveFolderModal(null)}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </DialogTitle>
                  <div className="mt-4 max-h-64 overflow-y-auto space-y-2">
                    <button
                      onClick={() =>
                        showMoveFolderModal &&
                        handleMoveToFolder(showMoveFolderModal, null)
                      }
                      className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-3 group"
                    >
                      <FolderIcon className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        Root (No folder)
                      </span>
                    </button>
                    {folders.map((folder) => (
                      <button
                        key={folder.folder_id}
                        onClick={() =>
                          showMoveFolderModal &&
                          handleMoveToFolder(
                            showMoveFolderModal,
                            folder.folder_id,
                          )
                        }
                        className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-3 group"
                      >
                        <FolderIcon className="w-5 h-5 text-primary-200 group-hover:text-primary-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          {folder.folder_name}
                        </span>
                      </button>
                    ))}
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
