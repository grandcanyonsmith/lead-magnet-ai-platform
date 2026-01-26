import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Job } from "@/types/job";
import {
  WorkflowAIImprovement,
  WorkflowImprovementStatus,
} from "@/types/workflow";
import { truncate } from "@/utils/formatting";
import {
  formatTimestamp,
  HistoryItem,
  IMPROVEMENT_STATUS_META,
} from "./utils";

interface ImprovementDetailsProps {
  activeHistory: HistoryItem;
  isCurrentHistory: boolean;
  improvementStatusMeta:
    | {
        label: string;
        variant: "warning" | "success" | "destructive";
        description: string;
      }
    | null;
  activeJobId: string | undefined;
  contextJobId: string | undefined;
  selectedImprovement: WorkflowAIImprovement | null;
  job: Job;
  handleReview: (status: WorkflowImprovementStatus) => void;
  isReviewing: boolean;
  reviewState: {
    jobId: string;
    status: WorkflowImprovementStatus;
  } | null;
}

export function ImprovementDetails({
  activeHistory,
  isCurrentHistory,
  improvementStatusMeta,
  activeJobId,
  contextJobId,
  selectedImprovement,
  job,
  handleReview,
  isReviewing,
  reviewState,
}: ImprovementDetailsProps) {
  const improvementStatus =
    selectedImprovement?.improvement_status || "pending";

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">
            {activeHistory?.title || "History"}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {activeHistory?.subtitle || "No history entries yet."}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isCurrentHistory ? (
            <Badge variant="outline">Current run</Badge>
          ) : null}
          {improvementStatusMeta ? (
            <Badge
              variant={improvementStatusMeta.variant}
              title={improvementStatusMeta.description}
            >
              {improvementStatusMeta.label}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <p className="text-xs text-muted-foreground">Job ID</p>
          <p className="text-sm font-mono text-foreground">
            {activeJobId ? truncate(activeJobId, 22) : "—"}
          </p>
          {activeJobId ? (
            <a
              href={`/dashboard/jobs/${activeJobId}`}
              className="text-xs text-primary-600 hover:underline"
            >
              Open job
            </a>
          ) : null}
        </div>
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <p className="text-xs text-muted-foreground">Context job</p>
          {contextJobId ? (
            <>
              <p className="text-sm font-mono text-foreground">
                {truncate(contextJobId, 22)}
              </p>
              <a
                href={`/dashboard/jobs/${contextJobId}`}
                className="text-xs text-primary-600 hover:underline"
              >
                Open job
              </a>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No context run linked
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <p className="text-xs text-muted-foreground">Created</p>
          <p className="text-sm font-medium text-foreground">
            {formatTimestamp(activeHistory?.createdAt)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <p className="text-xs text-muted-foreground">Updated</p>
          <p className="text-sm font-medium text-foreground">
            {formatTimestamp(selectedImprovement?.updated_at)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <p className="text-xs text-muted-foreground">Run status</p>
          <div className="mt-1">
            {isCurrentHistory ? (
              <StatusBadge status={job.status} />
            ) : selectedImprovement ? (
              <StatusBadge status={selectedImprovement.status} />
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background px-3 py-2">
        <p className="text-xs text-muted-foreground">Changes summary</p>
        <p className="text-sm text-foreground">
          {selectedImprovement?.result?.changes_summary ||
            (isCurrentHistory
              ? "Current run context does not include an improvement summary yet."
              : "No changes summary available for this improvement.")}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-background px-3 py-2">
        <p className="text-xs text-muted-foreground">Prompt</p>
        <p className="text-sm text-foreground whitespace-pre-wrap break-words">
          {selectedImprovement?.user_prompt ||
            (isCurrentHistory
              ? "No prompt recorded for the current run."
              : "No prompt available for this improvement.")}
        </p>
      </div>

      {selectedImprovement ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            Reviewed{" "}
            {selectedImprovement.reviewed_at
              ? formatTimestamp(selectedImprovement.reviewed_at)
              : "—"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedImprovement.improvement_status === "pending" ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => handleReview("approved")}
                  isLoading={
                    isReviewing && reviewState?.status === "approved"
                  }
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => handleReview("denied")}
                  isLoading={
                    isReviewing && reviewState?.status === "denied"
                  }
                >
                  Deny
                </Button>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                {IMPROVEMENT_STATUS_META[improvementStatus].description}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          AI improvements will appear here once generated.
        </div>
      )}
    </div>
  );
}
