import { SessionRecordings } from "@/components/jobs/SessionRecordings";
import { JobTrackingStats } from "@/components/tracking/JobTrackingStats";

interface JobTrackingTabProps {
  jobId: string;
}

export function JobTrackingTab({ jobId }: JobTrackingTabProps) {
  return (
    <div id="job-tab-panel-tracking" className="space-y-8">
      <JobTrackingStats jobId={jobId} />
      <SessionRecordings jobId={jobId} />
    </div>
  );
}
