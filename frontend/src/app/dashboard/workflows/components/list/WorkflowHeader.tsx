import React from "react";
import { useRouter } from "next/navigation";
import { Folder } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { LeadMagnetsTabs } from "@/components/leadMagnets/LeadMagnetsTabs";
import {
  ArrowLeftIcon,
  FolderPlusIcon,
  PlusIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

interface WorkflowHeaderProps {
  currentFolder: Folder | null;
  setCurrentFolderId: (id: string | null) => void;
  filteredCount: number;
  setShowCreateFolderModal: (show: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  hasWorkflows: boolean;
}

export function WorkflowHeader({
  currentFolder,
  setCurrentFolderId,
  filteredCount,
  setShowCreateFolderModal,
  searchQuery,
  setSearchQuery,
  hasWorkflows,
}: WorkflowHeaderProps) {
  const router = useRouter();

  return (
    <div className="mb-2">
      {currentFolder && (
        <button
          onClick={() => setCurrentFolderId(null)}
          className="group flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-1 group-hover:-translate-x-0.5 transition-transform" />
          Back to All Lead Magnets
        </button>
      )}

      <PageHeader
        heading={currentFolder ? currentFolder.folder_name : "Lead Magnets"}
        description={
          currentFolder
            ? `${filteredCount} lead magnet${
                filteredCount !== 1 ? "s" : ""
              } in this folder`
            : "Manage your AI lead magnets and their forms"
        }
        bottomContent={<LeadMagnetsTabs />}
      >
        <button
          onClick={() => setShowCreateFolderModal(true)}
          className="flex items-center justify-center px-4 py-2 border border-border text-foreground font-medium rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary text-sm"
        >
          <FolderPlusIcon className="w-5 h-5 mr-2 text-muted-foreground" />
          New Folder
        </button>
        <button
          onClick={() => router.push("/dashboard/workflows/new")}
          className="flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary text-sm flex-1 sm:flex-none"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Create Lead Magnet
        </button>
      </PageHeader>

      {/* Search Bar */}
      {hasWorkflows && (
        <div className="mb-6 mt-6">
          <div className="relative max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon
                className="h-5 w-5 text-gray-400"
                aria-hidden="true"
              />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lead magnets..."
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg leading-5 bg-white dark:bg-card dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-shadow shadow-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
