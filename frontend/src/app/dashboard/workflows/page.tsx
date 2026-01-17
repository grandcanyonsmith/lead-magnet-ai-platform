"use client";

import { useWorkflows } from "@/hooks/api/useWorkflows";
import { useWorkflowJobs } from "@/hooks/useWorkflowJobs";
import { useSettings } from "@/hooks/api/useSettings";
import { useWorkflowFolders } from "./hooks/useWorkflowFolders";
import { useWorkflowList } from "./hooks/useWorkflowList";
import { WorkflowHeader } from "./components/list/WorkflowHeader";
import { WorkflowFolderGrid } from "./components/list/WorkflowFolderGrid";
import { WorkflowListTable } from "./components/list/WorkflowListTable";
import { FolderModals } from "./components/list/FolderModals";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

export default function WorkflowsPage() {
  const { workflows, loading, refetch: refetchWorkflows } = useWorkflows();
  const { workflowJobs, loadingJobs } = useWorkflowJobs(workflows);
  const { settings } = useSettings();

  const {
    folders,
    currentFolderId,
    setCurrentFolderId,
    currentFolder,
    folderActionLoading,
    showCreateFolderModal,
    setShowCreateFolderModal,
    showMoveFolderModal,
    setShowMoveFolderModal,
    newFolderName,
    setNewFolderName,
    editingFolderId,
    setEditingFolderId,
    editingFolderName,
    setEditingFolderName,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleMoveToFolder,
  } = useWorkflowFolders(refetchWorkflows);

  const {
    searchQuery,
    setSearchQuery,
    sortField,
    sortDirection,
    filteredWorkflows,
    handleSort,
  } = useWorkflowList(workflows, workflowJobs, currentFolderId);

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this lead magnet? This will also delete its associated form.",
      )
    ) {
      return;
    }

    try {
      await api.deleteWorkflow(id);
      await refetchWorkflows();
      toast.success("Lead magnet deleted");
    } catch (error) {
      console.error("Failed to delete workflow:", error);
      toast.error("Failed to delete lead magnet");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-gray-200 dark:bg-secondary rounded w-48 animate-pulse"></div>
          <div className="flex gap-2">
            <div className="h-10 w-32 bg-gray-200 dark:bg-secondary rounded-lg animate-pulse"></div>
            <div className="h-10 w-40 bg-gray-200 dark:bg-secondary rounded-lg animate-pulse"></div>
          </div>
        </div>
        <div className="bg-white dark:bg-card rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-gray-100 dark:bg-secondary/50 rounded-lg animate-pulse"
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <WorkflowHeader
        currentFolder={currentFolder}
        setCurrentFolderId={setCurrentFolderId}
        filteredCount={filteredWorkflows.length}
        setShowCreateFolderModal={setShowCreateFolderModal}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        hasWorkflows={workflows.length > 0}
      />

      <WorkflowFolderGrid
        folders={folders}
        currentFolderId={currentFolderId}
        setCurrentFolderId={setCurrentFolderId}
        editingFolderId={editingFolderId}
        setEditingFolderId={setEditingFolderId}
        editingFolderName={editingFolderName}
        setEditingFolderName={setEditingFolderName}
        handleRenameFolder={handleRenameFolder}
        handleDeleteFolder={handleDeleteFolder}
        folderActionLoading={folderActionLoading}
      />

      <WorkflowListTable
        workflows={filteredWorkflows}
        workflowJobs={workflowJobs}
        loadingJobs={loadingJobs}
        sortField={sortField}
        sortDirection={sortDirection}
        handleSort={handleSort}
        handleDelete={handleDelete}
        handleMove={setShowMoveFolderModal}
        customDomain={settings?.custom_domain}
        hasWorkflows={workflows.length > 0}
        onClearSearch={() => setSearchQuery("")}
      />

      <FolderModals
        showCreateFolderModal={showCreateFolderModal}
        setShowCreateFolderModal={setShowCreateFolderModal}
        showMoveFolderModal={showMoveFolderModal}
        setShowMoveFolderModal={setShowMoveFolderModal}
        newFolderName={newFolderName}
        setNewFolderName={setNewFolderName}
        handleCreateFolder={handleCreateFolder}
        handleMoveToFolder={handleMoveToFolder}
        folders={folders}
        folderActionLoading={folderActionLoading}
      />
    </div>
  );
}
