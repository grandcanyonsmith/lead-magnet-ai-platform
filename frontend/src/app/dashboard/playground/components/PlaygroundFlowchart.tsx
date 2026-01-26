import React from "react";
import dynamic from "next/dynamic";
import { MergedStep } from "@/types/job";

const WorkflowFlowchart = dynamic(
  () => import("../../workflows/components/WorkflowFlowchart"),
  {
    loading: () => (
      <div className="h-[600px] w-full rounded-3xl border border-slate-200 dark:border-border bg-slate-50/70 dark:bg-card/60 flex items-center justify-center text-sm text-muted-foreground">
        Loading flowchart...
      </div>
    ),
  }
);

interface PlaygroundFlowchartProps {
  steps: MergedStep[];
  handleStepClick: (index: number) => void;
  addStep: () => void;
  reorderSteps: (steps: MergedStep[]) => void;
  activeStepIndex: number | null;
  setActiveTab: (tab: any) => void;
}

export const PlaygroundFlowchart: React.FC<PlaygroundFlowchartProps> = ({
  steps,
  handleStepClick,
  addStep,
  reorderSteps,
  activeStepIndex,
  setActiveTab,
}) => {
  return (
    <div className="flex-1 min-w-0 min-h-[240px] bg-slate-50 dark:bg-black/20 relative flex flex-col lg:min-h-0">
      <div className="flex-1 relative">
        <WorkflowFlowchart
          steps={steps as any}
          onStepClick={handleStepClick}
          onAddStep={addStep}
          onStepsReorder={(newSteps) => reorderSteps(newSteps as any)}
          activeStepIndex={activeStepIndex}
          onTriggerClick={() => setActiveTab("input")}
        />
      </div>
    </div>
  );
};
