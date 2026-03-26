import { useMemo } from "react";
import { CheckCircleIcon, XCircleIcon, ClockIcon } from "@heroicons/react/24/outline";
import { JobOverviewSection } from "@/components/jobs/detail/JobOverviewSection";
import { FinalDeliverableCard } from "@/components/jobs/detail/FinalDeliverableCard";
import type { ArtifactGalleryItem, Job, MergedStep } from "@/types/job";
import type { Status } from "@/types/common";

interface JobSummaryTabProps {
  artifactGalleryItems: ArtifactGalleryItem[];
  loadingArtifacts?: boolean;
  onPreview: (item: ArtifactGalleryItem) => void;
  job?: Job | null;
  mergedSteps?: MergedStep[];
  totalCost?: number | null;
  jobDurationFormatted?: string | null;
}

const STATUS_DISPLAY: Record<Status, { label: string; className: string }> = {
  completed: { label: "Completed", className: "text-emerald-600 dark:text-emerald-400" },
  failed: { label: "Failed", className: "text-red-600 dark:text-red-400" },
  processing: { label: "Processing", className: "text-blue-600 dark:text-blue-400" },
  pending: { label: "Pending", className: "text-muted-foreground" },
};

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{children}</span>
    </div>
  );
}

export function JobSummaryTab({
  artifactGalleryItems,
  loadingArtifacts,
  onPreview,
  job,
  mergedSteps,
  totalCost,
  jobDurationFormatted,
}: JobSummaryTabProps) {
  const { finalDeliverables, otherArtifacts } = useMemo(() => {
    const finals: ArtifactGalleryItem[] = [];
    const others: ArtifactGalleryItem[] = [];
    for (const item of artifactGalleryItems) {
      if (item.kind === "jobOutput") {
        finals.push(item);
      } else {
        others.push(item);
      }
    }
    return { finalDeliverables: finals, otherArtifacts: others };
  }, [artifactGalleryItems]);

  const primaryStep = useMemo(() => {
    if (!mergedSteps?.length) return null;
    return mergedSteps.find((s) => s.step_type === "ai_generation" || s.step_type === "workflow_step") ?? null;
  }, [mergedSteps]);

  const statusDisplay = job?.status ? STATUS_DISPLAY[job.status] : null;

  return (
    <div className="space-y-5">
      {finalDeliverables.map((item) => (
        <FinalDeliverableCard
          key={item.id}
          item={item}
          onPreview={onPreview}
        />
      ))}

      {job && (
        <div className="rounded-xl bg-card shadow-[0_1px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_24px_rgba(0,0,0,0.15)] p-5">
          <h3 className="text-base font-semibold text-foreground mb-3">Project Summary</h3>
          <div className="divide-y divide-border/50">
            {statusDisplay && (
              <SummaryRow label="Status:">
                <span className={statusDisplay.className}>{statusDisplay.label}</span>
              </SummaryRow>
            )}
            {jobDurationFormatted && (
              <SummaryRow label="Runtime:">
                {jobDurationFormatted}
              </SummaryRow>
            )}
            {typeof totalCost === "number" && totalCost > 0 && (
              <SummaryRow label="Cost:">
                ${totalCost.toFixed(2)}
              </SummaryRow>
            )}
          </div>
        </div>
      )}

      {primaryStep && (
        <div className="rounded-xl bg-card shadow-[0_1px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_24px_rgba(0,0,0,0.15)] p-5">
          <h3 className="text-base font-semibold text-foreground mb-3">Configuration</h3>
          <div className="divide-y divide-border/50">
            {primaryStep.model && (
              <SummaryRow label="Model:">
                {primaryStep.model}
              </SummaryRow>
            )}
            {primaryStep.usage_info?.service_type && (
              <SummaryRow label="Reasoning:">
                {primaryStep.usage_info.service_type}
              </SummaryRow>
            )}
            {primaryStep.tools && primaryStep.tools.length > 0 && (
              <SummaryRow label="Tools:">
                {primaryStep.tools
                  .map((t) => (typeof t === "string" ? t : (t as any)?.type || "tool"))
                  .join(", ")}
              </SummaryRow>
            )}
          </div>
        </div>
      )}

      {otherArtifacts.length > 0 && (
        <JobOverviewSection
          artifactGalleryItems={otherArtifacts}
          loadingArtifacts={loadingArtifacts}
          onPreview={onPreview}
        />
      )}
    </div>
  );
}
