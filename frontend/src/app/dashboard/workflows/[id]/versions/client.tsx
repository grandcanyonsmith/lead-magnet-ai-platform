"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { FullScreenPreviewModal } from "@/components/ui/FullScreenPreviewModal";
import { usePreviewModal } from "@/hooks/usePreviewModal";
import type { ArtifactGalleryItem } from "@/types/job";

import { useVersionHistory } from "./hooks/useVersionHistory";
import { VersionList } from "./components/VersionList";
import { VersionDetails } from "./components/VersionDetails";
import { VersionJobs } from "./components/VersionJobs";

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
  
  const {
    workflowId,
    workflow,
    jobs,
    loading,
    error,
    restoringVersion,
    selectedVersion,
    setSelectedVersion,
    selectedJobId,
    setSelectedJobId,
    artifactsLoading,
    versionDetailsLoading,
    loadData,
    sortedVersions,
    currentVersion,
    selectedVersionSummary,
    selectedVersionSteps,
    workflowTitle,
    workflowSubtitle,
    lastUpdatedLabel,
    jobsByVersion,
    selectedVersionJobs,
    selectedJob,
    artifactGalleryItems,
    handleRestore,
  } = useVersionHistory();

  const { previewItem, openPreview, closePreview } =
    usePreviewModal<ArtifactGalleryItem>();

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

  const handleBack = () => {
    if (workflowId) {
      router.push(`/dashboard/workflows/${workflowId}/edit`);
    } else {
      router.back();
    }
  };

  return (
    <div className="container mx-auto max-w-7xl space-y-10 pb-16 px-4 sm:px-6">
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
          <VersionList
            sortedVersions={sortedVersions}
            currentVersion={currentVersion}
            selectedVersion={selectedVersion}
            setSelectedVersion={setSelectedVersion}
            jobsByVersion={jobsByVersion}
            restoringVersion={restoringVersion}
            handleRestore={handleRestore}
            formatTimestamp={formatTimestamp}
          />

          <div className="space-y-4 lg:col-span-8 xl:col-span-9">
            <VersionDetails
              selectedVersion={selectedVersion}
              currentVersion={currentVersion}
              selectedVersionSummary={selectedVersionSummary}
              workflow={workflow}
              workflowTitle={workflowTitle}
              selectedVersionJobsCount={selectedVersionJobs.length}
              formatTimestamp={formatTimestamp}
              versionDetailsLoading={versionDetailsLoading}
              selectedVersionSteps={selectedVersionSteps}
            />

            <VersionJobs
              selectedVersionJobs={selectedVersionJobs}
              selectedJobId={selectedJobId}
              setSelectedJobId={setSelectedJobId}
              selectedJob={selectedJob}
              artifactGalleryItems={artifactGalleryItems}
              artifactsLoading={artifactsLoading}
              onPreview={openPreview}
            />
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
