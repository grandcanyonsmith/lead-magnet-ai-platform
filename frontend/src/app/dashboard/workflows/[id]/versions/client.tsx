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
import type {
  Workflow,
  WorkflowVersionRecord,
  WorkflowVersionSummary,
} from "@/types";

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
  const [versionDetailsByNumber, setVersionDetailsByNumber] = useState<
    Record<number, WorkflowVersionRecord>
  >({});
  const [versionDetailsLoading, setVersionDetailsLoading] = useState<
    number | null
  >(null);

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

  const selectedVersionRecord = useMemo(() => {
    if (!selectedVersion) return null;
    return versionDetailsByNumber[selectedVersion] ?? null;
  }, [selectedVersion, versionDetailsByNumber]);

  const selectedVersionSteps = useMemo(() => {
    return selectedVersionRecord?.snapshot?.steps ?? [];
  }, [selectedVersionRecord]);

  const workflowTitle = workflow?.workflow_name ?? "—";
  const workflowTitleShort = workflow?.workflow_name
    ? truncate(workflow.workflow_name, 56)
    : "Lead magnet details";
  const workflowSubtitle = workflow?.workflow_name
    ? `Lead magnet: ${workflowTitleShort}`
    : "Lead magnet details";
  const lastUpdatedLabel = useMemo(() => {
    const latestTimestamp = sortedVersions[0]?.created_at;
    const fallbackTimestamp = workflow?.updated_at;
    if (latestTimestamp) return formatRelativeTime(latestTimestamp);
    if (fallbackTimestamp) return formatRelativeTime(fallbackTimestamp);
    return "—";
  }, [sortedVersions, workflow?.updated_at]);

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
    setVersionDetailsByNumber({});
    setVersionDetailsLoading(null);
  }, [workflowId]);

  useEffect(() => {
    if (!workflowId || !selectedVersion) return;
    if (versionDetailsByNumber[selectedVersion]) return;

    let isActive = true;
    setVersionDetailsLoading(selectedVersion);

    api
      .getWorkflowVersion(workflowId, selectedVersion)
      .then((response) => {
        if (!isActive) return;
        setVersionDetailsByNumber((prev) => ({
          ...prev,
          [selectedVersion]: response,
        }));
      })
      .catch((err: any) => {
        if (!isActive) return;
        toast.error(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to load version details",
        );
      })
      .finally(() => {
        if (!isActive) return;
        setVersionDetailsLoading((current) =>
          current === selectedVersion ? null : current,
        );
      });

    return () => {
      isActive = false;
    };
  }, [selectedVersion, versionDetailsByNumber, workflowId]);

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
    if (!selectedJobId) {
      setArtifactsLoading(false);
      return;
    }
    if (artifactsByJobId[selectedJobId]) {
      setArtifactsLoading(false);
      return;
    }

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

  const previewFileNameFromUrl = (() => {
    if (!previewObjectUrl) return undefined;
    try {
      const url = new URL(previewObjectUrl);
      const name = url.pathname.split("/").pop();
      return name || undefined;
    } catch {
      const name = previewObjectUrl.split("/").pop();
      return name || undefined;
    }
  })();

  const previewFileName =
    previewItem?.artifact?.file_name ||
    previewItem?.artifact?.artifact_name ||
    previewFileNameFromUrl ||
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
    <div className="container mx-auto max-w-7xl space-y-10 pb-16">
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur shadow-sm">
        <div className="flex flex-col gap-3 py-4 sm:gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="-ml-2 h-9 w-9 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    Version history
                  </h1>
                  {currentVersion ? (
                    <Badge variant="secondary" className="font-medium">
                      Current v{currentVersion}
                    </Badge>
                  ) : null}
                </div>
                <p
                  className="mt-1 truncate text-sm text-muted-foreground"
                  title={workflow?.workflow_name || undefined}
                >
                  {workflowSubtitle}
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
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge
              variant="outline"
              className="border-border/60 text-muted-foreground font-medium"
            >
              {sortedVersions.length} versions
            </Badge>
            <Badge
              variant="outline"
              className="border-border/60 text-muted-foreground font-medium"
            >
              {jobs.length} jobs
            </Badge>
            <Badge
              variant="outline"
              className="border-border/60 text-muted-foreground font-medium"
            >
              Updated {lastUpdatedLabel}
            </Badge>
          </div>
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
        <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
          <SectionCard
            title={`All versions (${sortedVersions.length})`}
            description="Restore an earlier configuration to create a new version."
            padding="sm"
            stickyHeader
            className="lg:col-span-4 xl:col-span-3 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-hidden"
            contentClassName="lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-1"
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
                  const versionMeta = [
                    `Saved ${formatTimestamp(version.created_at)}`,
                    `${version.step_count} steps`,
                    version.template_version
                      ? `template v${version.template_version}`
                      : "no template version",
                  ].join(" • ");
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
                      className={`group flex w-full cursor-pointer flex-col gap-3 rounded-xl border px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 sm:flex-row sm:items-center sm:justify-between ${
                        isSelected
                          ? "border-primary/40 bg-primary/5 shadow-sm"
                          : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/30"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            v{version.version}
                          </span>
                          {isCurrent ? (
                            <Badge variant="success">Current</Badge>
                          ) : null}
                          {isSelected ? (
                            <Badge
                              variant="outline"
                              className="border-primary/40 text-primary"
                            >
                              Selected
                            </Badge>
                          ) : null}
                          {versionJobsCount > 0 ? (
                            <Badge variant="secondary">
                              {versionJobsCount} jobs
                            </Badge>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {versionMeta}
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
                          className="shrink-0"
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

          <div className="space-y-4 lg:col-span-8 xl:col-span-9">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.65fr)_minmax(0,0.35fr)] xl:items-start">
              <SectionCard
                title="Selected version"
                description="Details for the version you are reviewing."
                padding="sm"
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-3xl font-semibold text-foreground">
                      {selectedVersion ? `v${selectedVersion}` : "—"}
                    </span>
                    {selectedVersion === currentVersion ? (
                      <Badge variant="success">Active</Badge>
                    ) : null}
                    {selectedVersionSummary?.template_version ? (
                      <Badge variant="secondary">
                        Template v{selectedVersionSummary.template_version}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Saved {formatTimestamp(selectedVersionSummary?.created_at)}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border bg-muted/30 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Lead magnet</p>
                      <p
                        className="mt-1 truncate text-sm font-medium text-foreground"
                        title={workflow?.workflow_name || undefined}
                      >
                        {workflowTitle}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Steps</p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {selectedVersionSummary
                          ? selectedVersionSummary.step_count
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Template</p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {selectedVersionSummary
                          ? selectedVersionSummary.template_version
                            ? `v${selectedVersionSummary.template_version}`
                            : "None"
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 px-3 py-2">
                      <p className="text-xs text-muted-foreground">
                        Jobs generated
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {selectedVersion ? selectedVersionJobs.length : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="About restores"
                description="Restores create a new version."
                padding="sm"
                className="border-dashed bg-muted/20"
              >
                <ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground">
                  <li>Restoring does not delete existing versions.</li>
                  <li>The restored configuration becomes the latest version.</li>
                  <li>Make sure to review steps after a restore.</li>
                </ul>
              </SectionCard>
            </div>

            <SectionCard
              title="Execution step instructions"
              description="See the saved instructions for each step in this version."
              padding="sm"
              contentClassName="xl:max-h-[520px] xl:overflow-y-auto xl:pr-1"
            >
              {!selectedVersion ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                  Select a version to view its step instructions.
                </div>
              ) : versionDetailsLoading === selectedVersion ? (
                <div
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  role="status"
                >
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
                    aria-hidden="true"
                  />
                  Loading step instructions...
                </div>
              ) : selectedVersionSteps.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                  No steps are available for this version.
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedVersionSteps.map((step, index) => {
                    const stepLabel = step.step_name || `Step ${index + 1}`;
                    return (
                      <div
                        key={`${step.step_name}-${index}`}
                        className="rounded-xl border bg-card/60 px-4 py-3 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {stepLabel}
                            </p>
                            {step.step_description ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {step.step_description}
                              </p>
                            ) : null}
                          </div>
                          <Badge variant="outline">Step {index + 1}</Badge>
                        </div>
                        <div className="mt-3 rounded-lg border bg-background/80 px-3 py-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            Instructions
                          </p>
                          <pre className="mt-2 whitespace-pre-wrap text-sm text-foreground font-sans">
                            {step.instructions || "—"}
                          </pre>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.45fr)_minmax(0,0.55fr)] xl:items-start">
              <SectionCard
                title={`Generated lead magnets (${selectedVersionJobs.length})`}
                description="Select a job to preview the generated deliverables."
                padding="sm"
                contentClassName="xl:max-h-[520px] xl:overflow-y-auto xl:pr-1"
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
                      onPreview={openPreview}
                    />
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                    Select a job to preview its artifacts.
                  </div>
                )}
              </SectionCard>
            </div>
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
