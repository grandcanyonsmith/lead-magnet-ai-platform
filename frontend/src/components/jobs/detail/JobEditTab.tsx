import { WorkflowEditor } from "@/components/workflows/edit/WorkflowEditor";
import { LoadingState } from "@/components/ui/LoadingState";
import type { Workflow } from "@/types/workflow";

interface JobEditTabProps {
  workflow?: Workflow | null;
  onExit?: () => void;
}

export function JobEditTab({ workflow, onExit }: JobEditTabProps) {
  if (!workflow?.workflow_id) {
    return (
      <LoadingState
        message="Loading lead magnet editor..."
        variant="spinner"
        className="py-10"
      />
    );
  }

  return (
    <WorkflowEditor
      workflowIdOverride={workflow.workflow_id}
      portalTargetId="job-edit-subheader"
      onExit={onExit}
      onSaveSuccess={() => onExit?.()}
      loadingFullPage={false}
    />
  );
}
