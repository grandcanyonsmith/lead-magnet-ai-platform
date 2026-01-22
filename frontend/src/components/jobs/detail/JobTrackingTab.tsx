import { SessionRecordings } from "@/components/jobs/SessionRecordings";
import { JobTrackingStats } from "@/components/tracking/JobTrackingStats";
import type { TrackingStats } from "@/lib/api/tracking.client";

interface JobTrackingTabProps {
  jobId: string;
  onSessionsLoaded?: (count: number) => void;
  onSessionsLoadingChange?: (loading: boolean) => void;
  onStatsLoaded?: (stats: TrackingStats | null) => void;
  onStatsLoadingChange?: (loading: boolean) => void;
}

export function JobTrackingTab({
  jobId,
  onSessionsLoaded,
  onSessionsLoadingChange,
  onStatsLoaded,
  onStatsLoadingChange,
}: JobTrackingTabProps) {
  return (
    <div id="job-tab-panel-tracking" className="space-y-8">
      <JobTrackingStats
        jobId={jobId}
        onStatsLoaded={onStatsLoaded}
        onStatsLoadingChange={onStatsLoadingChange}
      />
      <SessionRecordings
        jobId={jobId}
        onSessionsLoaded={onSessionsLoaded}
        onSessionsLoadingChange={onSessionsLoadingChange}
      />
    </div>
  );
}
