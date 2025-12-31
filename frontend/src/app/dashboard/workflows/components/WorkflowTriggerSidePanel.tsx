"use client";

import { FiX } from "react-icons/fi";
import { WorkflowTrigger } from "@/types/workflow";
import WorkflowTriggerEditor from "./WorkflowTriggerEditor";

interface WorkflowTriggerSidePanelProps {
  trigger: WorkflowTrigger;
  isOpen: boolean;
  onClose: () => void;
  onChange: (trigger: WorkflowTrigger) => void;
  workflowId: string;
  settings?: any;
}

export default function WorkflowTriggerSidePanel({
  trigger,
  isOpen,
  onClose,
  onChange,
  workflowId,
  settings,
}: WorkflowTriggerSidePanelProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Side Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-2xl bg-white dark:bg-gray-950 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } overflow-y-auto`}
      >
        <div className="sticky top-0 z-10 border-b border-slate-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 px-6 py-5 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-gray-400 select-none">
                Configuration
              </div>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
                Workflow Trigger
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                Choose how this workflow starts.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-2 text-slate-400 dark:text-gray-400 shadow-sm transition hover:border-primary-200 dark:hover:border-primary-800 hover:text-primary-600 dark:hover:text-primary-300 hover:bg-slate-50 dark:hover:bg-gray-800"
              aria-label="Close panel"
            >
              <FiX className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="space-y-6 bg-white dark:bg-gray-950 px-6 py-6 pb-24">
          <WorkflowTriggerEditor
            trigger={trigger}
            onChange={onChange}
            workflowId={workflowId}
            settings={settings}
          />
        </div>
      </div>
    </>
  );
}

