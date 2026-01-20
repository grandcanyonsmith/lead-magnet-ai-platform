import { JobOverviewSection } from "@/components/jobs/detail/JobOverviewSection";
import type { ArtifactGalleryItem } from "@/types/job";

interface JobSummaryTabProps {
  artifactGalleryItems: ArtifactGalleryItem[];
  loadingArtifacts?: boolean;
  onPreview: (item: ArtifactGalleryItem) => void;
}

export function JobSummaryTab({
  artifactGalleryItems,
  loadingArtifacts,
  onPreview,
}: JobSummaryTabProps) {
  return (
    <JobOverviewSection
      artifactGalleryItems={artifactGalleryItems}
      loadingArtifacts={loadingArtifacts}
      onPreview={onPreview}
    />
  );
}
