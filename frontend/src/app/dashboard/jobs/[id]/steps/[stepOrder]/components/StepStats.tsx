import React from "react";
import { CollapsibleSectionCard } from "@/components/ui/CollapsibleSectionCard";
import { StepStatsCard } from "@/components/jobs/detail/StepStatsCard";
import type { MergedStep } from "@/types/job";

interface StepStatsProps {
  statsPreview: string;
  step: MergedStep | null;
  stepTypeLabel: string;
  toolChoice: any;
  toolLabels: string[];
  durationLabel: string | null;
  startedAtLabel: string | null;
  completedAtLabel: string | null;
  formattedCost: string | null;
  usageRows: { label: string; value: string }[];
  jobStatus?: string;
}

export function StepStats({
  statsPreview,
  step,
  stepTypeLabel,
  toolChoice,
  toolLabels,
  durationLabel,
  startedAtLabel,
  completedAtLabel,
  formattedCost,
  usageRows,
  jobStatus,
}: StepStatsProps) {
  if (!step) return null;

  return (
    <CollapsibleSectionCard
      title="Step stats"
      description="Configuration, timing, and usage details."
      preview={statsPreview}
    >
      <StepStatsCard
        step={step}
        stepTypeLabel={stepTypeLabel}
        toolChoice={toolChoice}
        toolLabels={toolLabels}
        durationLabel={durationLabel}
        startedAtLabel={startedAtLabel}
        completedAtLabel={completedAtLabel}
        formattedCost={formattedCost}
        usageRows={usageRows}
        jobStatus={jobStatus}
      />
    </CollapsibleSectionCard>
  );
}
