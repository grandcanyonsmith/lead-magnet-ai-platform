import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import type {
  Workflow,
  WorkflowVersionRecord,
  WorkflowVersionSummary,
} from "@/types";
import type { Artifact } from "@/types/artifact";
import type { ArtifactGalleryItem, Job } from "@/types/job";
import { buildArtifactGalleryItems } from "@/utils/jobs/artifacts";
import { formatRelativeTime } from "@/utils/date";
import { truncate } from "@/utils/formatting";

export function useVersionHistory() {
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
    return sortedVersions.find((version) => version.version === selectedVersion) ?? null;
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

  return {
    workflowId,
    workflow,
    versions,
    jobs,
    loading,
    error,
    restoringVersion,
    selectedVersion,
    setSelectedVersion,
    selectedJobId,
    setSelectedJobId,
    artifactsByJobId,
    artifactsLoading,
    versionDetailsByNumber,
    versionDetailsLoading,
    loadData,
    sortedVersions,
    currentVersion,
    selectedVersionSummary,
    selectedVersionRecord,
    selectedVersionSteps,
    workflowTitle,
    workflowTitleShort,
    workflowSubtitle,
    lastUpdatedLabel,
    jobsByVersion,
    selectedVersionJobs,
    selectedJob,
    selectedJobArtifacts,
    artifactGalleryItems,
    handleRestore,
  };
}
