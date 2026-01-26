import {
  ArrowPathIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { WorkflowImprovementStatus } from "@/types/workflow";
import {
  HistoryItem,
  IMPROVEMENT_STATUS_META,
} from "./utils";

interface ImprovementHistoryListProps {
  historyItems: HistoryItem[];
  statusCounts: {
    total: number;
    pending: number;
    approved: number;
    denied: number;
  };
  historySearch: string;
  setHistorySearch: (value: string) => void;
  statusFilter: "all" | WorkflowImprovementStatus;
  setStatusFilter: (value: "all" | WorkflowImprovementStatus) => void;
  improvementsLoading: boolean;
  filteredHistoryItems: HistoryItem[];
  activeHistoryId: string;
  setSelectedHistoryId: (id: string) => void;
  handleRefreshHistory: () => void;
  handleClearFilters: () => void;
}

export function ImprovementHistoryList({
  historyItems,
  statusCounts,
  historySearch,
  setHistorySearch,
  statusFilter,
  setStatusFilter,
  improvementsLoading,
  filteredHistoryItems,
  activeHistoryId,
  setSelectedHistoryId,
  handleRefreshHistory,
  handleClearFilters,
}: ImprovementHistoryListProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-foreground">History</div>
          <div className="text-xs text-muted-foreground">
            Browse AI improvements and the current run context.
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleRefreshHistory}
          isLoading={improvementsLoading}
          className="h-8 w-full sm:w-auto"
        >
          {!improvementsLoading && (
            <ArrowPathIcon className="h-4 w-4 mr-1.5" />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-sm font-semibold text-foreground">
            {statusCounts.total}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="text-sm font-semibold text-foreground">
            {statusCounts.pending}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <p className="text-xs text-muted-foreground">Approved</p>
          <p className="text-sm font-semibold text-foreground">
            {statusCounts.approved}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <p className="text-xs text-muted-foreground">Denied</p>
          <p className="text-sm font-semibold text-foreground">
            {statusCounts.denied}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,190px)]">
        <div className="relative">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={historySearch}
            onChange={(event) => setHistorySearch(event.target.value)}
            placeholder="Search improvements..."
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(nextValue) =>
            setStatusFilter(nextValue as "all" | WorkflowImprovementStatus)
          }
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending review</option>
          <option value="approved">Approved</option>
          <option value="denied">Denied</option>
        </Select>
      </div>

      <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          Showing {filteredHistoryItems.length} of {historyItems.length}{" "}
          entries
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          disabled={!historySearch && statusFilter === "all"}
          className="w-full sm:w-auto"
        >
          Clear filters
        </Button>
      </div>

      {improvementsLoading && filteredHistoryItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
          Loading improvements...
        </div>
      ) : filteredHistoryItems.length > 0 ? (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {filteredHistoryItems.map((item) => {
            const isSelected = item.id === activeHistoryId;
            const statusMeta = item.status
              ? IMPROVEMENT_STATUS_META[item.status]
              : null;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedHistoryId(item.id)}
                className={`group w-full rounded-lg border px-3 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  isSelected
                    ? "border-primary/40 bg-primary/5 shadow-sm"
                    : "border-border bg-background hover:border-muted-foreground/30 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p
                      className="text-sm font-semibold text-foreground truncate"
                      title={item.title}
                    >
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.subtitle || "No summary available"}
                    </p>
                    {item.improvement?.user_prompt ? (
                      <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                        Prompt: {item.improvement.user_prompt}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {item.isCurrent ? (
                      <Badge variant="outline">Current</Badge>
                    ) : null}
                    {statusMeta ? (
                      <Badge
                        variant={statusMeta.variant}
                        title={statusMeta.description}
                      >
                        {statusMeta.label}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                {item.improvement?.result?.changes_summary ? (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                    {item.improvement.result.changes_summary}
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
          No improvements match your filters.
        </div>
      )}
    </div>
  );
}
