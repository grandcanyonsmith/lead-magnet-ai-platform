import React from "react";
import { WorkflowStep } from "@/types/workflow";
import {
  FIELD_LABEL,
  FIELD_REQUIRED,
  FIELD_OPTIONAL,
  CONTROL_BASE,
} from "../constants";

interface StepBasicsProps {
  step: WorkflowStep;
  index: number;
  onChange: (field: keyof WorkflowStep, value: any) => void;
  isFocusMode: boolean;
}

export default function StepBasics({
  step,
  index,
  onChange,
  isFocusMode,
}: StepBasicsProps) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/10 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-semibold text-foreground">Step details</h5>
        {!isFocusMode && (
          <span className="text-xs text-muted-foreground">Step {index + 1}</span>
        )}
      </div>
      <div className="space-y-1.5">
        <label className={FIELD_LABEL} htmlFor={`step-name-${index}`}>
          <span>Step Name</span>
          <span className={FIELD_REQUIRED}>*</span>
        </label>
        <input
          id={`step-name-${index}`}
          type="text"
          value={step.step_name}
          onChange={(e) => onChange("step_name", e.target.value)}
          className={`${CONTROL_BASE} text-base font-semibold`}
          placeholder="e.g., Deep Research"
          required
          aria-label="Instruction name"
          aria-required="true"
        />
      </div>
      <div className="space-y-1.5">
        <label className={FIELD_LABEL} htmlFor={`step-description-${index}`}>
          <span>Description</span>
          <span className={FIELD_OPTIONAL}>(Optional)</span>
        </label>
        <textarea
          id={`step-description-${index}`}
          value={step.step_description || ""}
          onChange={(e) => onChange("step_description", e.target.value)}
          className={`${CONTROL_BASE} min-h-[80px] resize-y leading-relaxed bg-muted/30 border-transparent hover:bg-background hover:border-input focus:bg-background focus:border-ring`}
          placeholder="Brief description of what this step does"
          rows={2}
          aria-label="Instruction description"
        />
      </div>
    </div>
  );
}
