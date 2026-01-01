import React, { Fragment } from "react";
import { Folder } from "@/types";
import {
  FolderIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from "@headlessui/react";
import clsx from "clsx";

interface WorkflowFolderGridProps {
  folders: Folder[];
  currentFolderId: string | null;
  setCurrentFolderId: (id: string | null) => void;
  editingFolderId: string | null;
  setEditingFolderId: (id: string | null) => void;
  editingFolderName: string;
  setEditingFolderName: (name: string) => void;
  handleRenameFolder: (folderId: string) => void;
  handleDeleteFolder: (folderId: string) => void;
  folderActionLoading: boolean;
}

export function WorkflowFolderGrid({
  folders,
  currentFolderId,
  setCurrentFolderId,
  editingFolderId,
  setEditingFolderId,
  editingFolderName,
  setEditingFolderName,
  handleRenameFolder,
  handleDeleteFolder,
  folderActionLoading,
}: WorkflowFolderGridProps) {
  if (currentFolderId || folders.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
        <FolderIcon className="w-4 h-4" />
        Folders
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {folders.map((folder) => (
          <div key={folder.folder_id} className="relative group">
            {editingFolderId === folder.folder_id ? (
              <div className="bg-white dark:bg-card rounded-xl border-2 border-primary-500 p-3 shadow-sm">
                <input
                  type="text"
                  value={editingFolderName}
                  onChange={(e) => setEditingFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameFolder(folder.folder_id);
                    if (e.key === "Escape") {
                      setEditingFolderId(null);
                      setEditingFolderName("");
                    }
                  }}
                  className="w-full text-sm border-0 border-b border-gray-200 dark:border-gray-700 p-0 pb-1 focus:ring-0 focus:border-primary-500 bg-transparent dark:text-white"
                  autoFocus
                  disabled={folderActionLoading}
                />
                <div className="flex gap-2 mt-2 justify-end">
                  <button
                    onClick={() => {
                      setEditingFolderId(null);
                      setEditingFolderName("");
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                    disabled={folderActionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleRenameFolder(folder.folder_id)}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
                    disabled={folderActionLoading}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setCurrentFolderId(folder.folder_id)}
                className="group/card cursor-pointer w-full bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-primary-200 dark:hover:border-primary-800 hover:shadow-md transition-all relative"
              >
                <div className="flex items-start justify-between mb-2">
                  <FolderIcon className="w-8 h-8 text-primary-100 dark:text-primary-900 fill-primary-50 dark:fill-primary-900/30 group-hover/card:text-primary-200 dark:group-hover/card:text-primary-800 transition-colors" />
                  <Menu as="div" className="relative">
                    <MenuButton
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover/card:opacity-100 transition-opacity focus:outline-none"
                    >
                      <EllipsisVerticalIcon className="w-4 h-4" />
                    </MenuButton>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-100"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <MenuItems className="absolute right-0 mt-1 w-36 origin-top-right bg-white rounded-lg shadow-lg ring-1 ring-black/5 focus:outline-none z-10">
                        <div className="py-1">
                          <MenuItem>
                            {({ active }) => (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingFolderId(folder.folder_id);
                                  setEditingFolderName(folder.folder_name);
                                }}
                                className={clsx(
                                  active ? "bg-gray-50" : "",
                                  "flex w-full items-center px-4 py-2 text-xs text-gray-700",
                                )}
                              >
                                <PencilIcon className="mr-2 h-3.5 w-3.5 text-gray-400" />
                                Rename
                              </button>
                            )}
                          </MenuItem>
                          <MenuItem>
                            {({ active }) => (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFolder(folder.folder_id);
                                }}
                                className={clsx(
                                  active ? "bg-red-50" : "",
                                  "flex w-full items-center px-4 py-2 text-xs text-red-600",
                                )}
                              >
                                <TrashIcon className="mr-2 h-3.5 w-3.5 text-red-400" />
                                Delete
                              </button>
                            )}
                          </MenuItem>
                        </div>
                      </MenuItems>
                    </Transition>
                  </Menu>
                </div>
                <div className="font-medium text-gray-900 dark:text-white truncate text-sm mb-0.5">
                  {folder.folder_name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {folder.workflow_count || 0} item
                  {(folder.workflow_count || 0) !== 1 ? "s" : ""}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
