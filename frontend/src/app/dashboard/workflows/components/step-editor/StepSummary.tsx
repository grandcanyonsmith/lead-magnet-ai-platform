"use client";

import React from "react";
import { WorkflowStep } from "@/types/workflow";

interface StepSummaryProps {
  step: WorkflowStep;
  isFocusMode?: boolean;
}

const formatModelLabel = (model?: string) => {
  if (!model) return "Auto";
  return model
    .replace("gpt-", "GPT-")
    .replace("turbo", "Turbo")
    .replace("computer-use-preview", "Computer Use");
};

const formatOutputLabel = (step: WorkflowStep) => {
  const outputType = step.output_format?.type || "text";
  if (outputType === "json_schema") return "JSON Schema";
  if (outputType === "json_object") return "JSON Object";
  return "Text";
};

export default function StepSummary({ step, isFocusMode = false }: StepSummaryProps) {
  const toolCount = step.tools?.length || 0;
  const hasTools = toolCount > 0;

  return (
    <div
      className={`flex flex-wrap items-center gap-2.5 rounded-xl border border-border/60 px-4 py-2.5 text-sm text-muted-foreground ${
        isFocusMode ? "bg-primary/5" : "bg-muted/20"
      }`}
    >
      <span className="font-semibold text-foreground">{formatModelLabel(step.model)}</span>
      <span aria-hidden="true">•</span>
      <span>{formatOutputLabel(step)}</span>
      <span aria-hidden="true">•</span>
      <span>{hasTools ? `${toolCount} tools` : "No tools"}</span>
    </div>
  );
}
