import React from "react";
import { FiLoader } from "react-icons/fi";
import { ResubmitModal } from "@/components/jobs/ResubmitModal";
import { RerunStepDialog } from "@/components/jobs/RerunStepDialog";
import { FullScreenPreviewModal } from "@/components/ui/FullScreenPreviewModal";
import FlowchartSidePanel from "@/app/dashboard/workflows/components/FlowchartSidePanel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Workflow, WorkflowStep } from "@/types";
import { ArtifactGalleryItem } from "@/types/job";

interface JobDetailModalsProps {
  showResubmitModal: boolean;
  setShowResubmitModal: (show: boolean) => void;
  handleResubmitConfirm: () => Promise<void>;
  resubmitting: boolean;
  
  editingStepIndex: number | null;
  /** Present when the job is tied to a workflow (used while workflow JSON is still loading). */
  jobWorkflowId: string | null;
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
  jobWorkflowId,
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
  const showEditPanel =
    editingStepIndex !== null &&
    isSidePanelOpen &&
    workflow?.steps?.[editingStepIndex];
  const showEditLoadingOrError =
    editingStepIndex !== null &&
    isSidePanelOpen &&
    !showEditPanel;

  return (
    <>
      {showResubmitModal && (
        <ResubmitModal
          isOpen={showResubmitModal}
          onClose={() => setShowResubmitModal(false)}
          onConfirm={handleResubmitConfirm}
          isResubmitting={resubmitting}
        />
      )}

      {showEditPanel && workflow?.steps?.[editingStepIndex!] != null && (
        <FlowchartSidePanel
          step={workflow.steps[editingStepIndex!]}
          index={editingStepIndex!}
          totalSteps={workflow.steps!.length}
          allSteps={workflow.steps!}
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

      {showEditLoadingOrError && (
        <Sheet
          open={isSidePanelOpen}
          onOpenChange={(open) => {
            if (!open) handleCancelEdit();
          }}
        >
          <SheetContent
            side="right"
            showCloseButton
            className="w-full max-w-md sm:max-w-md"
          >
            <SheetHeader>
              <SheetTitle>Edit workflow step</SheetTitle>
              <SheetDescription>
                {!jobWorkflowId
                  ? "This job is not linked to a workflow."
                  : !workflow
                    ? "Loading workflow data."
                    : `Step ${(editingStepIndex ?? 0) + 1} is not in the current workflow; it may have changed since this run.`}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              {!jobWorkflowId ? null : !workflow ? (
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <FiLoader className="h-4 w-4 shrink-0 animate-spin" />
                  <span>Loading workflow…</span>
                </div>
              ) : !workflow.steps?.[editingStepIndex!] ? (
                <p className="text-sm text-muted-foreground">
                  Close this panel and try refreshing the job page.
                </p>
              ) : null}
              <Button type="button" variant="secondary" onClick={handleCancelEdit}>
                Close
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {showRerunDialog && (
        <RerunStepDialog
          isOpen={showRerunDialog}
          onClose={handleCloseRerunDialog}
          onRerunOnly={handleRerunOnly}
          onRerunAndContinue={handleRerunAndContinue}
          stepNumber={stepIndexForRerun !== null ? stepIndexForRerun + 1 : 0}
          stepName={
            stepIndexForRerun !== null
              ? workflow?.steps?.[stepIndexForRerun]?.step_name ??
                mergedSteps.find(
                  (s) => s.step_order === stepIndexForRerun + 1,
                )?.step_name
              : undefined
          }
          isRerunning={rerunningStep !== null}
        />
      )}

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
