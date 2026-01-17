import { SessionRecordings } from "@/components/jobs/SessionRecordings";
import { JobTrackingStats } from "@/components/tracking/JobTrackingStats";

interface JobTrackingTabProps {
  jobId: string;
  onSessionsLoaded?: (count: number) => void;
  onSessionsLoadingChange?: (loading: boolean) => void;
}

export function JobTrackingTab({
  jobId,
  onSessionsLoaded,
  onSessionsLoadingChange,
}: JobTrackingTabProps) {
  return (
    <div id="job-tab-panel-tracking" className="space-y-8">
      <JobTrackingStats jobId={jobId} />
      <SessionRecordings
        jobId={jobId}
        onSessionsLoaded={onSessionsLoaded}
        onSessionsLoadingChange={onSessionsLoadingChange}
      />
    </div>
  );
}
