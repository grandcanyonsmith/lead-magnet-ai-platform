"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import toast from "react-hot-toast";

import { api } from "@/lib/api";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ArtifactGallery } from "@/components/jobs/detail/ArtifactGallery";
import { FullScreenPreviewModal } from "@/components/ui/FullScreenPreviewModal";
import { usePreviewModal } from "@/hooks/usePreviewModal";
import { buildArtifactGalleryItems } from "@/utils/jobs/artifacts";
import { formatRelativeTime } from "@/utils/date";
import { truncate } from "@/utils/formatting";

import type { Artifact } from "@/types/artifact";
import type { ArtifactGalleryItem, Job } from "@/types/job";
import type { Workflow, WorkflowVersionSummary } from "@/types";

const formatTimestamp = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export default function WorkflowVersionsClient() {
  const router = useRouter();
  const params = useParams();

  const workflowId = useMemo(() => {
    const paramId = params?.id as string;
    if (paramId && paramId !== "_") {
      return paramId;
    }
    if (typeof window !== "undefined") {
      const pathMatch = window.location.pathname.match(
        /\/dashboard\/workflows\/([^/]+)\/versions/,
      );
      if (pathMatch && pathMatch[1] && pathMatch[1] !== "_") {
        return pathMatch[1];
      }
    }
    return paramId || "";
  }, [params]);

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [versions, setVersions] = useState<WorkflowVersionSummary[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [artifactsByJobId, setArtifactsByJobId] = useState<
    Record<string, Artifact[]>
  >({});
  const [artifactsLoading, setArtifactsLoading] = useState(false);

  const { previewItem, openPreview, closePreview } =
    usePreviewModal<ArtifactGalleryItem>();

  const loadData = useCallback(async () => {
    if (!workflowId) return;
    setLoading(true);
    setError(null);
    try {
      const [workflowResponse, versionsResponse, jobsResponse] = await Promise.all([
        api.getWorkflow(workflowId),
        api.getWorkflowVersions(workflowId),
        api.getJobs({ workflow_id: workflowId, limit: 200 }),
      ]);
      setWorkflow(workflowResponse);
      setVersions(versionsResponse.versions || []);
      setJobs(jobsResponse.jobs || []);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load version history",
      );
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    if (workflowId) {
      void loadData();
    }
  }, [workflowId, loadData]);

  const sortedVersions = useMemo(() => {
    return [...versions].sort((a, b) => b.version - a.version);
  }, [versions]);

  const currentVersion = workflow?.version ?? null;
  const selectedVersionSummary = useMemo(() => {
    if (!selectedVersion) return null;
    return sortedVersions.find((version) => version.version === selectedVersion);
  }, [sortedVersions, selectedVersion]);

  const jobsByVersion = useMemo(() => {
    const byVersion: Record<number, Job[]> = {};
    sortedVersions.forEach((version) => {
      byVersion[version.version] = [];
    });

    if (!sortedVersions.length) {
      return byVersion;
    }

    const versionsByTime = [...sortedVersions].sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeB - timeA;
    });

    const resolveVersionForJob = (job: Job) => {
      const jobTime = new Date(job.created_at).getTime();
      if (Number.isNaN(jobTime)) return null;

      for (const version of versionsByTime) {
        const versionTime = new Date(version.created_at || 0).getTime();
        if (!Number.isNaN(versionTime) && jobTime >= versionTime) {
          return version.version;
        }
      }

      return versionsByTime[versionsByTime.length - 1]?.version ?? null;
    };

    jobs.forEach((job) => {
      const versionNumber = resolveVersionForJob(job);
      if (!versionNumber) return;
      if (!byVersion[versionNumber]) {
        byVersion[versionNumber] = [];
      }
      byVersion[versionNumber].push(job);
    });

    Object.values(byVersion).forEach((versionJobs) => {
      versionJobs.sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return timeB - timeA;
      });
    });

    return byVersion;
  }, [jobs, sortedVersions]);

  const selectedVersionJobs = useMemo(() => {
    if (!selectedVersion) return [];
    return jobsByVersion[selectedVersion] || [];
  }, [jobsByVersion, selectedVersion]);

  const selectedJob = useMemo(() => {
    if (!selectedJobId) return null;
    return jobs.find((job) => job.job_id === selectedJobId) || null;
  }, [jobs, selectedJobId]);

  const selectedJobArtifacts = useMemo(() => {
    if (!selectedJobId) return [];
    return artifactsByJobId[selectedJobId] || [];
  }, [artifactsByJobId, selectedJobId]);

  const artifactGalleryItems = useMemo(() => {
    if (!selectedJob) return [];
    return buildArtifactGalleryItems({
      job: selectedJob,
      artifacts: selectedJobArtifacts,
    });
  }, [selectedJob, selectedJobArtifacts]);

  useEffect(() => {
    if (!selectedVersion && sortedVersions.length) {
      setSelectedVersion(currentVersion ?? sortedVersions[0]?.version ?? null);
    }
  }, [currentVersion, selectedVersion, sortedVersions]);

  useEffect(() => {
    if (!selectedVersion) {
      setSelectedJobId(null);
      return;
    }
    const jobsForVersion = jobsByVersion[selectedVersion] || [];
    if (!jobsForVersion.length) {
      setSelectedJobId(null);
      return;
    }
    if (selectedJobId && jobsForVersion.some((job) => job.job_id === selectedJobId)) {
      return;
    }
    setSelectedJobId(jobsForVersion[0]?.job_id ?? null);
  }, [jobsByVersion, selectedJobId, selectedVersion]);

  useEffect(() => {
    if (!selectedJobId) return;
    if (artifactsByJobId[selectedJobId]) return;

    let isActive = true;
    setArtifactsLoading(true);

    api
      .getArtifacts({ job_id: selectedJobId, limit: 200 })
      .then((response) => {
        if (!isActive) return;
        setArtifactsByJobId((prev) => ({
          ...prev,
          [selectedJobId]: response.artifacts || [],
        }));
      })
      .catch((err: any) => {
        if (!isActive) return;
        toast.error(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to load artifacts",
        );
      })
      .finally(() => {
        if (!isActive) return;
        setArtifactsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [artifactsByJobId, selectedJobId]);

  const previewObjectUrl =
    previewItem?.artifact?.object_url ||
    previewItem?.artifact?.public_url ||
    previewItem?.url;

  const previewContentType =
    previewItem?.artifact?.content_type ||
    (previewItem?.kind === "imageUrl" ? "image/png" : undefined);

  const previewFileName =
    previewItem?.artifact?.file_name ||
    previewItem?.artifact?.artifact_name ||
    previewItem?.label;

  const currentPreviewIndex = useMemo(() => {
    if (!previewItem) return -1;
    return artifactGalleryItems.findIndex((item) => item.id === previewItem.id);
  }, [previewItem, artifactGalleryItems]);

  const handleNextPreview = () => {
    if (
      currentPreviewIndex === -1 ||
      currentPreviewIndex === artifactGalleryItems.length - 1
    )
      return;
    openPreview(artifactGalleryItems[currentPreviewIndex + 1]);
  };

  const handlePreviousPreview = () => {
    if (currentPreviewIndex <= 0) return;
    openPreview(artifactGalleryItems[currentPreviewIndex - 1]);
  };

  const handleRestore = async (version: number) => {
    if (!workflowId) return;
    if (
      !confirm(
        `Restore lead magnet to version v${version}? This will create a new version with the restored settings.`,
      )
    ) {
      return;
    }

    setRestoringVersion(version);
    try {
      await api.restoreWorkflowVersion(workflowId, version);
      toast.success(`Restored to version v${version}`);
      await loadData();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to restore version",
      );
    } finally {
      setRestoringVersion(null);
    }
  };

  const handleBack = () => {
    if (workflowId) {
      router.push(`/dashboard/workflows/${workflowId}/edit`);
    } else {
      router.back();
    }
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 pb-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sticky top-0 z-20 bg-background/95 backdrop-blur py-4 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="h-9 w-9 text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Version history
              </h1>
              {currentVersion ? (
                <Badge variant="secondary">v{currentVersion}</Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              Track and restore previous lead magnet configurations.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={loadData}
            disabled={!workflowId || loading}
            className="gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 dark:border-destructive/40 bg-destructive/10 dark:bg-destructive/20 p-4 text-destructive dark:text-destructive">
          <div className="flex items-center gap-2 font-medium">
            Error
          </div>
          <p className="mt-1 text-sm opacity-90">{error}</p>
        </div>
      )}

      {loading ? (
        <LoadingState message="Loading version history..." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <SectionCard
            title={`All versions (${sortedVersions.length})`}
            description="Restore an earlier configuration to create a new version."
            padding="sm"
          >
            {sortedVersions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                No versions found yet.
              </div>
            ) : (
              <div className="space-y-3">
                {sortedVersions.map((version) => {
                  const isCurrent = version.version === currentVersion;
                  const isSelected = version.version === selectedVersion;
                  const versionJobsCount =
                    jobsByVersion[version.version]?.length ?? 0;
                  return (
                    <div
                      key={version.version}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedVersion(version.version)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedVersion(version.version);
                        }
                      }}
                      className={`flex w-full cursor-pointer flex-col gap-3 rounded-lg border px-4 py-3 text-left transition-colors sm:flex-row sm:items-center sm:justify-between ${
                        isSelected
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-card hover:bg-muted/30"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            v{version.version}
                          </span>
                          {isCurrent ? (
                            <Badge variant="success">Current</Badge>
                          ) : null}
                          {versionJobsCount > 0 ? (
                            <Badge variant="secondary">
                              {versionJobsCount} jobs
                            </Badge>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Saved {formatTimestamp(version.created_at)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {version.step_count} steps ·{" "}
                          {version.template_version
                            ? `template v${version.template_version}`
                            : "no template version"}
                        </div>
                      </div>

                      {!isCurrent ? (
                        <Button
                          variant="outline"
                          size="sm"
                          isLoading={restoringVersion === version.version}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRestore(version.version);
                          }}
                        >
                          Restore
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <div className="space-y-4">
            <SectionCard
              title="Selected version"
              description="Details for the version you are reviewing."
              padding="sm"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-semibold text-foreground">
                    {selectedVersion ? `v${selectedVersion}` : "—"}
                  </span>
                  {selectedVersion === currentVersion ? (
                    <Badge variant="success">Active</Badge>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  Saved {formatTimestamp(selectedVersionSummary?.created_at)}
                </p>
                <div className="space-y-2 text-sm text-foreground">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Lead magnet</span>
                    <span className="font-medium">
                      {workflow?.workflow_name || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Steps</span>
                    <span className="font-medium">
                      {selectedVersionSummary?.step_count ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Template</span>
                    <span className="font-medium">
                      {selectedVersionSummary?.template_version
                        ? `v${selectedVersionSummary.template_version}`
                        : "None"}
                    </span>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title={`Generated lead mags (${selectedVersionJobs.length})`}
              description="Select a job to preview the generated deliverables."
              padding="sm"
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
                        className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                          isSelected
                            ? "border-primary/40 bg-primary/5"
                            : "border-border bg-background hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p
                              className="text-sm font-semibold text-foreground truncate"
                              title={job.job_id}
                            >
                              {truncate(job.job_id, 32)}
                            </p>
                            <p
                              className="mt-1 text-xs text-muted-foreground truncate"
                              title={subtitle}
                            >
                              {subtitle}
                            </p>
                          </div>
                          <StatusBadge status={job.status} />
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        Job {truncate(selectedJob.job_id, 28)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Created {formatRelativeTime(selectedJob.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={selectedJob.status} />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(`/dashboard/jobs/${selectedJob.job_id}`)
                        }
                      >
                        View job
                      </Button>
                    </div>
                  </div>

                  <ArtifactGallery
                    items={artifactGalleryItems}
                    loading={artifactsLoading}
                    onPreview={openPreview}
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                  Select a job to preview its artifacts.
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="About restores"
              description="Restores create a new version."
              padding="sm"
            >
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Restoring does not delete existing versions.</li>
                <li>The restored configuration becomes the latest version.</li>
                <li>Make sure to review steps after a restore.</li>
              </ul>
            </SectionCard>
          </div>
        </div>
      )}

      {previewItem && previewObjectUrl && (
        <FullScreenPreviewModal
          isOpen={!!previewItem}
          onClose={closePreview}
          contentType={previewContentType}
          objectUrl={previewObjectUrl}
          fileName={previewFileName}
          artifactId={previewItem?.artifact?.artifact_id}
          onNext={handleNextPreview}
          onPrevious={handlePreviousPreview}
          hasNext={currentPreviewIndex < artifactGalleryItems.length - 1}
          hasPrevious={currentPreviewIndex > 0}
        />
      )}
    </div>
  );
}
