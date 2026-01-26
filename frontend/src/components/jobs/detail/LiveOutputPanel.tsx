"use client";

import { FiLoader } from "react-icons/fi";
import { LiveOutputRenderer } from "@/components/jobs/LiveOutputRenderer";
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
    <div className="mb-4 rounded-lg border border-blue-200 dark:border-blue-800/40 bg-blue-50/60 dark:bg-blue-900/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FiLoader className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-300" />
          <span className="text-xs font-semibold text-blue-800 dark:text-blue-200">
            Live output (streaming)
          </span>
          {liveStatus && (
            <span className="rounded-full border border-blue-200/70 dark:border-blue-800/40 bg-blue-100/60 dark:bg-blue-900/20 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-200">
              {liveStatus}
            </span>
          )}
          {job?.live_step?.truncated && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              Output truncated
            </span>
          )}
        </div>
        {liveUpdatedAtLabel && (
          <span className="text-[11px] text-blue-700/70 dark:text-blue-200/60">
            Updated {liveUpdatedAtLabel}
          </span>
        )}
      </div>
      <LiveOutputRenderer
        value={hasLiveOutput ? liveOutputText : "Waiting for model output..."}
        className="mt-2 max-h-72 overflow-y-auto font-mono text-xs leading-relaxed text-gray-800 dark:text-gray-200 scrollbar-hide-until-hover"
        textClassName="m-0 whitespace-pre-wrap break-words"
      />
      {job?.live_step?.error && (
        <p className="mt-2 text-xs text-red-600">{job.live_step.error}</p>
      )}
    </div>
  );
}
