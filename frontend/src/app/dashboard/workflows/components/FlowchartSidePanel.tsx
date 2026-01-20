"use client";

import { useEffect, useState, useRef } from "react";
import { FiX } from "react-icons/fi";
import WorkflowStepEditor from "./WorkflowStepEditor";
import { WorkflowStep } from "@/types/workflow";

interface FlowchartSidePanelProps {
  step: WorkflowStep | null;
  index: number | null;
  totalSteps: number;
  allSteps?: WorkflowStep[]; // All steps for dependency selection
  isOpen: boolean;
  onClose: () => void;
  onChange: (index: number, step: WorkflowStep) => void;
  onDelete: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  workflowId?: string; // Required for AI features
}

export default function FlowchartSidePanel({
  step,
  index,
  totalSteps,
  allSteps = [],
  isOpen,
  onClose,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  workflowId,
}: FlowchartSidePanelProps) {
  const [localStep, setLocalStep] = useState<WorkflowStep | null>(step);
  const latestStepRef = useRef<WorkflowStep | null>(step);

  useEffect(() => {
    setLocalStep(step);
    latestStepRef.current = step;
  }, [step]);

  if (!isOpen || !step || index === null) {
    return null;
  }

  const handleChange = (idx: number, updatedStep: WorkflowStep) => {
    setLocalStep(updatedStep);
    latestStepRef.current = updatedStep;
    onChange(idx, updatedStep);
  };

  const handleClose = () => {
    // Ensure any pending changes are saved before closing
    // Use ref to get the latest state, as localStep might be stale
    const latestStep = latestStepRef.current;
    if (latestStep && index !== null) {
      onChange(index, latestStep);
    }
    onClose();
  };

  const handleDelete = () => {
    if (index !== null) {
      onDelete(index);
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Side Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-2xl bg-white dark:bg-gray-950 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } overflow-y-auto`}
      >
        <div className="sticky top-0 z-10 border-b border-slate-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 px-6 py-5 shadow-sm backdrop-blur-md">
          <div className="flex items-start justify-between gap-4">
            <div
              className="min-w-0 flex-1"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-gray-400 select-none">
                Editing Step {index + 1} of {totalSteps}
              </div>
              <h2
                className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white break-words line-clamp-2"
                title={step.step_name || `Step ${index + 1}`}
              >
                {step.step_name || `Step ${index + 1}`}
              </h2>
              <p
                className="mt-1 text-sm text-slate-500 dark:text-gray-400 line-clamp-2"
                title={
                  step.step_description ||
                  "Update the step details, instructions, and tools below."
                }
              >
                {step.step_description ||
                  "Update the step details, instructions, and tools below."}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="rounded-full border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-2 text-slate-400 dark:text-gray-400 shadow-sm transition hover:border-primary-200 dark:hover:border-primary-800 hover:text-primary-600 dark:hover:text-primary-300 hover:bg-slate-50 dark:hover:bg-gray-800"
              aria-label="Close panel"
            >
              <FiX className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="space-y-6 bg-white dark:bg-gray-950 px-6 py-6 pb-24">
          {localStep && (
            <WorkflowStepEditor
              step={localStep}
              index={index}
              totalSteps={totalSteps}
              allSteps={allSteps}
              onChange={handleChange}
              onDelete={handleDelete}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              workflowId={workflowId}
            />
          )}
        </div>
      </div>
    </>
  );
}
