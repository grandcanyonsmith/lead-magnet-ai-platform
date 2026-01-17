"use client";

import { FiLoader, FiX } from "react-icons/fi";

type WorkflowSummary = {
  workflow_id: string;
  workflow_name?: string;
  workflow_description?: string;
};

interface PlaygroundImportModalProps {
  isOpen: boolean;
  isLoading: boolean;
  workflows: WorkflowSummary[];
  onClose: () => void;
  onSelect: (workflowId: string) => void;
}

export function PlaygroundImportModal({
  isOpen,
  isLoading,
  workflows,
  onClose,
  onSelect,
}: PlaygroundImportModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col border border-border">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h3 className="font-semibold">Import Workflow</h3>
          <button onClick={onClose}>
            <FiX className="w-5 h-5 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <FiLoader className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-1">
              {workflows.map((wf) => (
                <button
                  key={wf.workflow_id}
                  onClick={() => onSelect(wf.workflow_id)}
                  className="w-full text-left p-3 hover:bg-muted rounded-lg transition-colors flex flex-col gap-1"
                >
                  <span className="font-medium text-sm">
                    {wf.workflow_name || wf.workflow_id}
                  </span>
                  <span className="text-xs text-muted-foreground line-clamp-1">
                    {wf.workflow_description || "No description"}
                  </span>
                </button>
              ))}
              {workflows.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No workflows found.
                </div>
              )}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-border bg-muted/10 rounded-b-xl flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
