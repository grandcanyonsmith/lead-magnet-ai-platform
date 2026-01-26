import { useMemo } from "react";
import { useStepArtifacts } from "@/hooks/useStepArtifacts";
import { useJobAutoUploads } from "@/hooks/useJobAutoUploads";
import { buildArtifactGalleryItems } from "@/utils/jobs/artifacts";
import { Job, MergedStep } from "@/types/job";

export function useJobArtifactsData({
  job,
  mergedSteps,
  shouldLoadExecutionSteps,
}: {
  job: Job | null;
  mergedSteps: MergedStep[];
  shouldLoadExecutionSteps: boolean;
}) {
  const {
    imageArtifactsByStep,
    fileArtifactsByStep,
    artifacts: jobArtifacts,
    loading: loadingArtifacts,
  } = useStepArtifacts({
    jobId: job?.job_id,
    steps: mergedSteps,
    enabled: shouldLoadExecutionSteps,
  });

  const { items: autoUploads, loading: loadingAutoUploads } = useJobAutoUploads({
    jobId: job?.job_id,
    enabled: shouldLoadExecutionSteps,
    jobStatus: job?.status,
  });

  const jobOutputContext = useMemo(
    () =>
      job
        ? {
            job_id: job.job_id,
            output_url: job.output_url,
            completed_at: job.completed_at,
            failed_at: job.failed_at,
          }
        : null,
    [job]
  );

  const artifactGalleryItems = useMemo(() => {
    if (!shouldLoadExecutionSteps) return [];
    return buildArtifactGalleryItems({
      job: jobOutputContext,
      artifacts: jobArtifacts,
      steps: mergedSteps,
      autoUploads,
    });
  }, [
    autoUploads,
    jobArtifacts,
    mergedSteps,
    shouldLoadExecutionSteps,
    jobOutputContext,
  ]);

  const loadingOutputs = loadingArtifacts || loadingAutoUploads;

  return {
    imageArtifactsByStep,
    fileArtifactsByStep,
    jobArtifacts,
    autoUploads,
    artifactGalleryItems,
    loadingOutputs,
  };
}
