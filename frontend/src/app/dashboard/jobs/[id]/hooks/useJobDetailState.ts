import { useState } from "react";

export function useJobDetailState() {
  const [showResubmitModal, setShowResubmitModal] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [showRerunDialog, setShowRerunDialog] = useState(false);
  const [stepIndexForRerun, setStepIndexForRerun] = useState<number | null>(null);
  const [updatingStepIndex, setUpdatingStepIndex] = useState<number | null>(null);
  const [trackingSessionCount, setTrackingSessionCount] = useState<number | null>(null);
  const [trackingSessionsLoading, setTrackingSessionsLoading] = useState(false);
  const [trackingStats, setTrackingStats] = useState<any | null>(null);
  const [trackingStatsLoading, setTrackingStatsLoading] = useState(false);

  return {
    showResubmitModal,
    setShowResubmitModal,
    editingStepIndex,
    setEditingStepIndex,
    isSidePanelOpen,
    setIsSidePanelOpen,
    showRerunDialog,
    setShowRerunDialog,
    stepIndexForRerun,
    setStepIndexForRerun,
    updatingStepIndex,
    setUpdatingStepIndex,
    trackingSessionCount,
    setTrackingSessionCount,
    trackingSessionsLoading,
    setTrackingSessionsLoading,
    trackingStats,
    setTrackingStats,
    trackingStatsLoading,
    setTrackingStatsLoading,
  };
}
