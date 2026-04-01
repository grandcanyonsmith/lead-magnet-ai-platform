"use client";

import { useState } from "react";
import { SparklesIcon } from "@heroicons/react/24/outline";
import type { Artifact } from "@/types/artifact";
import { Tooltip } from "@/components/ui/Tooltip";
import { ArtifactEditModal } from "@/components/jobs/detail/ArtifactEditModal";
import { isEditableArtifact } from "@/utils/jobs/outputs";

interface ArtifactEditActionProps {
  artifact?: Artifact | null;
  buttonClassName?: string;
  tooltipContent?: string;
  ariaLabel?: string;
}

export function ArtifactEditAction({
  artifact,
  buttonClassName = "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
  tooltipContent = "Edit this file with AI",
  ariaLabel = "Edit file with AI",
}: ArtifactEditActionProps) {
  const [open, setOpen] = useState(false);

  if (!artifact || !isEditableArtifact(artifact) || !artifact.artifact_id) {
    return null;
  }

  const artifactName =
    artifact.file_name || artifact.artifact_name || "Generated file";

  return (
    <>
      <Tooltip content={tooltipContent} position="top">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            setOpen(true);
          }}
          className={buttonClassName}
          aria-label={ariaLabel}
        >
          <SparklesIcon className="h-4 w-4" />
        </button>
      </Tooltip>

      <ArtifactEditModal
        open={open}
        onOpenChange={setOpen}
        artifactId={artifact.artifact_id}
        artifactName={artifactName}
        contentType={artifact.content_type || artifact.mime_type}
        jobId={artifact.job_id}
      />
    </>
  );
}
