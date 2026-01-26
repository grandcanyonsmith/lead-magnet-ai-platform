import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ArtifactGallery } from "@/components/jobs/detail/ArtifactGallery";
import { formatRelativeTime } from "@/utils/date";
import { truncate } from "@/utils/formatting";
import type { Job, ArtifactGalleryItem } from "@/types/job";

interface VersionJobsProps {
  selectedVersionJobs: Job[];
  selectedJobId: string | null;
  setSelectedJobId: (jobId: string | null) => void;
  selectedJob: Job | null;
  artifactGalleryItems: ArtifactGalleryItem[];
  artifactsLoading: boolean;
  onPreview: (item: ArtifactGalleryItem) => void;
}

export function VersionJobs({
  selectedVersionJobs,
  selectedJobId,
  setSelectedJobId,
  selectedJob,
  artifactGalleryItems,
  artifactsLoading,
  onPreview,
}: VersionJobsProps) {
  const router = useRouter();

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.45fr)_minmax(0,0.55fr)] xl:items-start lg:col-span-8 xl:col-span-9">
      <SectionCard
        title={`Generated lead magnets (${selectedVersionJobs.length})`}
        description="Select a job to preview the generated deliverables."
        padding="sm"
        contentClassName="max-h-[300px] overflow-y-auto xl:max-h-[520px] xl:pr-1"
      >
        {selectedVersionJobs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            No jobs have been generated for this version yet.
          </div>
        ) : (
          <div className="space-y-2">
            {selectedVersionJobs.map((job) => {
              const isSelected = job.job_id === selectedJobId;
              const subtitle = [
                formatRelativeTime(job.created_at),
                job.status ? `Status: ${job.status}` : null,
              ]
                .filter(Boolean)
                .join(" • ");

              return (
                <button
                  key={job.job_id}
                  type="button"
                  onClick={() => setSelectedJobId(job.job_id)}
                  className={`group w-full rounded-lg border px-3 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 ${
                    isSelected
                      ? "border-primary/40 bg-primary/5 shadow-sm"
                      : "border-border bg-background hover:border-muted-foreground/30 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-semibold text-foreground"
                        title={job.job_id}
                      >
                        {truncate(job.job_id, 32)}
                      </p>
                      <p
                        className="mt-1 truncate text-xs text-muted-foreground"
                        title={subtitle}
                      >
                        {subtitle}
                      </p>
                    </div>
                    <StatusBadge status={job.status} className="shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Artifacts & preview"
        description="Rendered deliverables and supporting artifacts for the selected job."
        padding="sm"
      >
        {selectedJob ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  Job {truncate(selectedJob.job_id, 28)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Created {formatRelativeTime(selectedJob.created_at)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={selectedJob.status} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(`/dashboard/jobs/${selectedJob.job_id}`)
                  }
                  className="shrink-0"
                >
                  View job
                </Button>
              </div>
            </div>

            <ArtifactGallery
              items={artifactGalleryItems}
              loading={artifactsLoading}
              onPreview={onPreview}
            />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            Select a job to preview its artifacts.
          </div>
        )}
      </SectionCard>
    </div>
  );
}
