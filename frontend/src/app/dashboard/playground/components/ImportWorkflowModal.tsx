import React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/Dialog";
import { FiLoader } from "react-icons/fi";

interface ImportWorkflowModalProps {
  importModalOpen: boolean;
  setImportModalOpen: (open: boolean) => void;
  loadingWorkflows: boolean;
  availableWorkflows: any[];
  selectWorkflowToImport: (id: string) => void;
}

export const ImportWorkflowModal: React.FC<ImportWorkflowModalProps> = ({
  importModalOpen,
  setImportModalOpen,
  loadingWorkflows,
  availableWorkflows,
  selectWorkflowToImport,
}) => {
  return (
    <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
      <DialogContent className="flex max-h-[80vh] w-full max-w-lg flex-col gap-0 overflow-hidden rounded-xl border border-border bg-background p-0 shadow-2xl sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-border p-4 pr-12">
          <DialogTitle className="font-semibold">Import Workflow</DialogTitle>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loadingWorkflows ? (
            <div className="flex justify-center p-8">
              <FiLoader className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-1">
              {availableWorkflows.map((wf) => (
                <button
                  key={wf.workflow_id}
                  onClick={() => selectWorkflowToImport(wf.workflow_id)}
                  className="flex w-full flex-col gap-1 rounded-lg p-3 text-left transition-colors hover:bg-muted"
                >
                  <span className="text-sm font-medium">{wf.workflow_name}</span>
                  <span className="line-clamp-1 text-xs text-muted-foreground">
                    {wf.workflow_description || "No description"}
                  </span>
                </button>
              ))}
              {availableWorkflows.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No workflows found.
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end rounded-b-xl border-t border-border bg-muted/10 p-4">
          <button
            onClick={() => setImportModalOpen(false)}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
