"use client";

import { LiveOutputConsole } from "@/components/jobs/LiveOutputConsole";
import type { Job } from "@/types/job";

interface LiveOutputPanelProps {
  showLiveOutputPanel: boolean;
  liveStatus: string | null;
  job: Job | null;
  liveUpdatedAtLabel: string | null;
  hasLiveOutput: boolean;
  liveOutputText: string;
}

export function LiveOutputPanel({
  showLiveOutputPanel,
  liveStatus,
  job,
  liveUpdatedAtLabel,
  hasLiveOutput,
  liveOutputText,
}: LiveOutputPanelProps) {
  if (!showLiveOutputPanel) return null;

  return (
    <LiveOutputConsole
      value={hasLiveOutput ? liveOutputText : ""}
      statusLabel={liveStatus}
      updatedAtLabel={liveUpdatedAtLabel}
      isStreaming={
        job?.status === "processing" ||
        liveStatus === "streaming" ||
        liveStatus === "retrying"
      }
      truncated={Boolean(job?.live_step?.truncated)}
      error={job?.live_step?.error || null}
      emptyMessage="Waiting for the first streamed event. Search, tool activity, and model output will appear here as they arrive."
      className="mb-4"
      bodyHeightClassName="max-h-72"
    />
  );
}
