import React, { Fragment } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { FiX, FiLoader } from "react-icons/fi";

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
    <Transition appear show={importModalOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={() => setImportModalOpen(false)}
      >
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="bg-background rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col border border-border">
              <div className="p-4 border-b border-border flex justify-between items-center">
                <DialogTitle className="font-semibold">
                  Import Workflow
                </DialogTitle>
                <button onClick={() => setImportModalOpen(false)}>
                  <FiX className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {loadingWorkflows ? (
                  <div className="flex justify-center p-8">
                    <FiLoader className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-1">
                    {availableWorkflows.map((wf) => (
                      <button
                        key={wf.workflow_id}
                        onClick={() => selectWorkflowToImport(wf.workflow_id)}
                        className="w-full text-left p-3 hover:bg-muted rounded-lg transition-colors flex flex-col gap-1"
                      >
                        <span className="font-medium text-sm">
                          {wf.workflow_name}
                        </span>
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {wf.workflow_description || "No description"}
                        </span>
                      </button>
                    ))}
                    {availableWorkflows.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground text-sm">
                        No workflows found.
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-border bg-muted/10 rounded-b-xl flex justify-end">
                <button
                  onClick={() => setImportModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
};
