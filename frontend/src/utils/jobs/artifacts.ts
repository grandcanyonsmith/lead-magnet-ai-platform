import type { Artifact } from "@/types/artifact";
import type { ArtifactGalleryItem, Job, MergedStep } from "@/types/job";
import { formatStepLabel } from "./steps";

function normalizeUrlKey(url: string | null | undefined): string | null {
  const raw = (url || "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    // Ignore query strings (e.g., presigned URLs) and normalize to host+path.
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    // If it's not a valid URL, fall back to raw string match.
    return raw;
  }
}

interface BuildArtifactGalleryItemsArgs {
  job?: Job | null;
  artifacts?: Artifact[] | null;
  steps?: MergedStep[] | null;
}

export function buildArtifactGalleryItems({
  job,
  artifacts,
  steps,
}: BuildArtifactGalleryItemsArgs): ArtifactGalleryItem[] {
  const items: ArtifactGalleryItem[] = [];
  const seen = new Set<string>();
  const stepMetaByArtifactId = new Map<
    string,
    { stepOrder?: number; stepName?: string; stepType?: string }
  >();
  const stepsForMeta = steps ?? [];

  stepsForMeta.forEach((step) => {
    if (step.artifact_id) {
      stepMetaByArtifactId.set(step.artifact_id, {
        stepOrder: step.step_order ?? undefined,
        stepName: step.step_name,
        stepType: step.step_type,
      });
    }
  });

  artifacts?.forEach((artifact, index) => {
    const uniqueKey =
      artifact.artifact_id ||
      artifact.object_url ||
      artifact.public_url ||
      `${artifact.file_name || artifact.artifact_name || "artifact"}-${index}`;

    if (!uniqueKey || seen.has(uniqueKey)) {
      return;
    }

    seen.add(uniqueKey);

    const meta = artifact.artifact_id
      ? stepMetaByArtifactId.get(artifact.artifact_id)
      : undefined;
    const typeString =
      artifact.artifact_type?.toLowerCase() ||
      artifact.content_type?.toLowerCase() ||
      "";
    const isImage = typeString.includes("image");
    const label =
      meta?.stepOrder !== undefined || meta?.stepName
        ? formatStepLabel(meta?.stepOrder, meta?.stepType, meta?.stepName)
        : artifact.artifact_name || artifact.file_name || "Generated Artifact";

    const urlKey = artifact.object_url || artifact.public_url;
    if (urlKey) {
      seen.add(urlKey);
    }

    const createdTimestamp = artifact.created_at
      ? new Date(artifact.created_at).getTime()
      : undefined;
    const fallbackOrder =
      (meta?.stepOrder !== undefined
        ? meta.stepOrder * 1000
        : (index + 1) * 1000) + index;

    items.push({
      id: uniqueKey,
      kind: isImage ? "imageArtifact" : "artifact",
      artifact,
      stepOrder: meta?.stepOrder,
      stepName: meta?.stepName,
      stepType: meta?.stepType,
      label,
      description:
        artifact.artifact_type?.replace(/_/g, " ") ||
        artifact.file_name ||
        artifact.artifact_name,
      sortOrder: createdTimestamp ?? fallbackOrder,
    });
  });

  stepsForMeta.forEach((step) => {
    if (!step.image_urls || step.image_urls.length === 0) {
      return;
    }
    const label = formatStepLabel(
      step.step_order ?? undefined,
      step.step_type,
      step.step_name,
    );
    step.image_urls.forEach((url, idx) => {
      if (!url || seen.has(url)) {
        return;
      }
      seen.add(url);
      const sortOrder = (step.step_order ?? 0) * 1000 + idx + 0.5;
      items.push({
        id: `image-url-${step.step_order ?? 0}-${idx}`,
        kind: "imageUrl",
        url,
        stepOrder: step.step_order ?? undefined,
        stepName: step.step_name,
        stepType: step.step_type,
        label,
        description: "Generated image URL",
        sortOrder,
      });
    });
  });

  if (job?.output_url && !seen.has(job.output_url)) {
    const completionTimestamp = job.completed_at
      ? new Date(job.completed_at).getTime()
      : Number.MAX_SAFE_INTEGER - 1;

    // Try to find the actual final artifact so the editor has a stable artifact_id to load.
    // Prefer URL match (exact output), then html_final/markdown_final, then filename/content-type heuristics.
    // Note: backend returns artifacts sorted by created_at DESC (newest first), so we do NOT reverse.
    const jobOutputKey = normalizeUrlKey(job.output_url);
    const matchingArtifactByUrl = jobOutputKey
      ? (artifacts ?? []).find((a) => {
          const publicKey = normalizeUrlKey(a.public_url);
          const objectKey = normalizeUrlKey(a.object_url);
          return publicKey === jobOutputKey || objectKey === jobOutputKey;
        })
      : undefined;

    const finalArtifactCandidate = (artifacts ?? []).find((a) => {
      const artifactType = String(a.artifact_type || "").toLowerCase();
      const contentType = String(a.content_type || "").toLowerCase();
      const name = String(a.file_name || a.artifact_name || "").toLowerCase();
      return (
        artifactType === "html_final" ||
        artifactType === "markdown_final" ||
        name === "final.html" ||
        (contentType === "text/html" &&
          name.endsWith(".html") &&
          name.includes("final"))
      );
    });

    const matchingArtifact = matchingArtifactByUrl || finalArtifactCandidate;

    items.push({
      id: "job-output-url",
      kind: "jobOutput",
      jobId: job.job_id,
      url: job.output_url,
      label: "Final Deliverable",
      description: "Download the generated lead magnet document.",
      sortOrder: completionTimestamp,
      artifact: matchingArtifact,
    });
    seen.add(job.output_url);
  }

  return items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}
