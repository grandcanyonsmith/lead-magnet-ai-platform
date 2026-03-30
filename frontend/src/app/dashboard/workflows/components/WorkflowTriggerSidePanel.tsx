"use client";

import { FiX } from "react-icons/fi";
import { WorkflowTrigger } from "@/types/workflow";
import WorkflowTriggerEditor from "./WorkflowTriggerEditor";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";

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
  return (
    <Sheet
      modal={false}
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full max-w-2xl overflow-y-auto border-l border-border bg-background p-0 sm:max-w-2xl"
      >
        <div className="sticky top-0 z-10 border-b border-border bg-background/80 px-6 py-5 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between gap-4">
            <SheetHeader className="space-y-0 text-left">
              <div className="select-none text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Editing Trigger
              </div>
              <SheetTitle className="mt-1 text-2xl font-semibold text-foreground">
                Workflow Trigger
              </SheetTitle>
              <SheetDescription className="mt-1 text-sm text-muted-foreground">
                Choose how this workflow starts.
              </SheetDescription>
            </SheetHeader>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full border border-border bg-background text-muted-foreground shadow-sm transition hover:border-primary/30 hover:bg-muted hover:text-primary"
              aria-label="Close panel"
            >
              <FiX className="h-5 w-5" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="space-y-6 bg-background px-6 py-6 pb-24">
          <WorkflowTriggerEditor
            trigger={trigger}
            onChange={onChange}
            workflowId={workflowId}
            settings={settings}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

