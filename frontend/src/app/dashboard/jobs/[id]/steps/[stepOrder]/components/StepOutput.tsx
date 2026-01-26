import React from "react";
import { ClipboardDocumentIcon } from "@heroicons/react/24/outline";
import { CollapsibleSectionCard } from "@/components/ui/CollapsibleSectionCard";
import { LiveOutputPanel } from "@/components/jobs/detail/LiveOutputPanel";
import { StepContent } from "@/components/jobs/StepContent";
import type { Job } from "@/types/job";

interface StepOutputProps {
  outputPreview: string | null;
  handleCopyOutput: () => void;
  showLiveOutputPanel: boolean;
  liveStatus: string | null;
  job: Job | null;
  liveUpdatedAtLabel: string | null;
  hasLiveOutput: boolean;
  liveOutputText: string;
  outputIsEmpty: boolean;
  outputContent: any;
  stepImageUrls: string[];
}

export function StepOutput({
  outputPreview,
  handleCopyOutput,
  showLiveOutputPanel,
  liveStatus,
  job,
  liveUpdatedAtLabel,
  hasLiveOutput,
  liveOutputText,
  outputIsEmpty,
  outputContent,
  stepImageUrls,
}: StepOutputProps) {
  return (
    <CollapsibleSectionCard
      title="Output"
      description="Latest step output and rendered preview."
      defaultOpen
      preview={outputPreview}
      actions={
        <button
          type="button"
          onClick={handleCopyOutput}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
        >
          <ClipboardDocumentIcon className="h-3.5 w-3.5" />
          Copy
        </button>
      }
    >
      <LiveOutputPanel
        showLiveOutputPanel={Boolean(showLiveOutputPanel)}
        liveStatus={liveStatus}
        job={job}
        liveUpdatedAtLabel={liveUpdatedAtLabel}
        hasLiveOutput={hasLiveOutput}
        liveOutputText={liveOutputText}
      />
      {showLiveOutputPanel && outputIsEmpty ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Final output will appear once this step completes.
        </p>
      ) : (
        <StepContent
          formatted={outputContent}
          imageUrls={stepImageUrls}
        />
      )}
    </CollapsibleSectionCard>
  );
}
