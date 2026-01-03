import { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "react-hot-toast";
import { api } from "@/lib/api";
import { Folder } from "@/types";

export function useWorkflowFolders(refetchWorkflows: () => Promise<void> | void) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderActionLoading, setFolderActionLoading] = useState(false);
  
  // Modal states
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showMoveFolderModal, setShowMoveFolderModal] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");

  const loadFolders = useCallback(async () => {
    try {
      const data = await api.getFolders();
      setFolders(data.folders || []);
    } catch (error) {
      console.error("Failed to load folders:", error);
      toast.error("Failed to load folders");
    }
  }, []);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setFolderActionLoading(true);
    try {
      await api.createFolder({ folder_name: newFolderName.trim() });
      await loadFolders();
      setNewFolderName("");
      setShowCreateFolderModal(false);
      toast.success("Folder created");
    } catch (error: any) {
      console.error("Failed to create folder:", error);
      toast.error(error?.message || "Failed to create folder");
    } finally {
      setFolderActionLoading(false);
    }
  };

  const handleRenameFolder = async (folderId: string) => {
    if (!editingFolderName.trim()) return;
    setFolderActionLoading(true);
    try {
      await api.updateFolder(folderId, {
        folder_name: editingFolderName.trim(),
      });
      await loadFolders();
      setEditingFolderId(null);
      setEditingFolderName("");
      toast.success("Folder renamed");
    } catch (error: any) {
      console.error("Failed to rename folder:", error);
      toast.error(error?.message || "Failed to rename folder");
    } finally {
      setFolderActionLoading(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this folder? Lead magnets inside will be moved to the root.",
      )
    )
      return;
    setFolderActionLoading(true);
    try {
      await api.deleteFolder(folderId);
      await Promise.all([loadFolders(), refetchWorkflows()]);
      if (currentFolderId === folderId) {
        setCurrentFolderId(null);
      }
      toast.success("Folder deleted");
    } catch (error: any) {
      console.error("Failed to delete folder:", error);
      toast.error(error?.message || "Failed to delete folder");
    } finally {
      setFolderActionLoading(false);
    }
  };

  const handleMoveToFolder = async (
    workflowId: string,
    folderId: string | null,
  ) => {
    setFolderActionLoading(true);
    try {
      await api.moveWorkflowToFolder(workflowId, folderId);
      await refetchWorkflows();
      setShowMoveFolderModal(null);
      toast.success("Moved");
    } catch (error: any) {
      console.error("Failed to move workflow:", error);
      toast.error(error?.message || "Failed to move lead magnet");
    } finally {
      setFolderActionLoading(false);
    }
  };

  const currentFolder = useMemo(() => {
    if (!currentFolderId) return null;
    return folders.find((f) => f.folder_id === currentFolderId) || null;
  }, [currentFolderId, folders]);

  return {
    folders,
    currentFolderId,
    setCurrentFolderId,
    currentFolder,
    folderActionLoading,
    
    // Modal & Form States
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

    // Actions
    loadFolders,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleMoveToFolder,
  };
}
