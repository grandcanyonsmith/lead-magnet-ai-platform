"use client";

import { useEffect, useState, useRef } from "react";
import { FiX } from "react-icons/fi";
import WorkflowStepEditor from "./WorkflowStepEditor";
import { WorkflowStep } from "@/types/workflow";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";

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

  if (!step || index === null) {
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
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full max-w-2xl overflow-y-auto border-l border-border bg-background p-0 sm:max-w-2xl"
      >
        <div className="sticky top-0 z-10 border-b border-border bg-background/80 px-6 py-5 shadow-sm backdrop-blur-md">
          <div className="flex items-start justify-between gap-4">
            <SheetHeader className="min-w-0 flex-1 space-y-0 text-left">
              <div className="select-none text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Editing Step {index + 1} of {totalSteps}
              </div>
              <SheetTitle
                className="mt-1 break-words text-2xl font-semibold text-foreground line-clamp-2"
                title={step.step_name || `Step ${index + 1}`}
              >
                {step.step_name || `Step ${index + 1}`}
              </SheetTitle>
              <SheetDescription
                className="mt-1 line-clamp-2 text-sm text-muted-foreground"
                title={
                  step.step_description ||
                  "Update the step details, instructions, and tools below."
                }
              >
                {step.step_description ||
                  "Update the step details, instructions, and tools below."}
              </SheetDescription>
            </SheetHeader>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="rounded-full border border-border bg-background text-muted-foreground shadow-sm transition hover:border-primary/30 hover:bg-muted hover:text-primary"
              aria-label="Close panel"
            >
              <FiX className="h-5 w-5" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="space-y-6 bg-background px-6 py-6 pb-24">
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
      </SheetContent>
    </Sheet>
  );
}
