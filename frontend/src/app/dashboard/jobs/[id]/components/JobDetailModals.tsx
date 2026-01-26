import React from "react";
import { ResubmitModal } from "@/components/jobs/ResubmitModal";
import { RerunStepDialog } from "@/components/jobs/RerunStepDialog";
import { FullScreenPreviewModal } from "@/components/ui/FullScreenPreviewModal";
import FlowchartSidePanel from "@/app/dashboard/workflows/components/FlowchartSidePanel";
import { Workflow, WorkflowStep } from "@/types";
import { ArtifactGalleryItem } from "@/types/job";

interface JobDetailModalsProps {
  showResubmitModal: boolean;
  setShowResubmitModal: (show: boolean) => void;
  handleResubmitConfirm: () => Promise<void>;
  resubmitting: boolean;
  
  editingStepIndex: number | null;
  workflow: Workflow | null;
  isSidePanelOpen: boolean;
  handleCancelEdit: () => void;
  latestStepUpdateRef: React.MutableRefObject<WorkflowStep | null>;
  
  showRerunDialog: boolean;
  handleCloseRerunDialog: () => void;
  handleRerunOnly: () => Promise<void>;
  handleRerunAndContinue: () => Promise<void>;
  stepIndexForRerun: number | null;
  mergedSteps: any[]; // Using any[] for now to avoid complex type imports, ideally JobStep[]
  rerunningStep: number | null;
  
  previewItem: ArtifactGalleryItem | null;
  closePreview: () => void;
  previewContentType?: string;
  previewObjectUrl?: string;
  previewFileName?: string;
  handleNextPreview: () => void;
  handlePreviousPreview: () => void;
  hasNextPreview: boolean;
  hasPreviousPreview: boolean;
  artifactGalleryItems: ArtifactGalleryItem[];
}

export function JobDetailModals({
  showResubmitModal,
  setShowResubmitModal,
  handleResubmitConfirm,
  resubmitting,
  editingStepIndex,
  workflow,
  isSidePanelOpen,
  handleCancelEdit,
  latestStepUpdateRef,
  showRerunDialog,
  handleCloseRerunDialog,
  handleRerunOnly,
  handleRerunAndContinue,
  stepIndexForRerun,
  mergedSteps,
  rerunningStep,
  previewItem,
  closePreview,
  previewContentType,
  previewObjectUrl,
  previewFileName,
  handleNextPreview,
  handlePreviousPreview,
  hasNextPreview,
  hasPreviousPreview,
  artifactGalleryItems,
}: JobDetailModalsProps) {
  return (
    <>
      <ResubmitModal
        isOpen={showResubmitModal}
        onClose={() => setShowResubmitModal(false)}
        onConfirm={handleResubmitConfirm}
        isResubmitting={resubmitting}
      />

      {editingStepIndex !== null && workflow?.steps?.[editingStepIndex] && (
        <FlowchartSidePanel
          step={workflow.steps[editingStepIndex]}
          index={editingStepIndex}
          totalSteps={workflow.steps.length}
          allSteps={workflow.steps}
          isOpen={isSidePanelOpen}
          onClose={handleCancelEdit}
          onChange={(index, updatedStep) => {
            latestStepUpdateRef.current = updatedStep;
          }}
          onDelete={() => {}} // No-op as per original
          onMoveUp={() => {}} // No-op
          onMoveDown={() => {}} // No-op
          workflowId={workflow.workflow_id}
        />
      )}

      <RerunStepDialog
        isOpen={showRerunDialog}
        onClose={handleCloseRerunDialog}
        onRerunOnly={handleRerunOnly}
        onRerunAndContinue={handleRerunAndContinue}
        stepNumber={stepIndexForRerun !== null ? stepIndexForRerun + 1 : 0}
        stepName={
          stepIndexForRerun !== null
            ? mergedSteps[stepIndexForRerun]?.step_name
            : undefined
        }
        isRerunning={rerunningStep !== null}
      />

      {previewItem && previewObjectUrl && (
        <FullScreenPreviewModal
          isOpen={!!previewItem}
          onClose={closePreview}
          contentType={previewContentType}
          objectUrl={previewObjectUrl}
          fileName={previewFileName}
          artifactId={previewItem?.artifact?.artifact_id}
          jobId={previewItem?.jobId || previewItem?.artifact?.job_id}
          autoUploadKey={previewItem?.autoUploadKey}
          onNext={handleNextPreview}
          onPrevious={handlePreviousPreview}
          hasNext={hasNextPreview}
          hasPrevious={hasPreviousPreview}
        />
      )}
    </>
  );
}
