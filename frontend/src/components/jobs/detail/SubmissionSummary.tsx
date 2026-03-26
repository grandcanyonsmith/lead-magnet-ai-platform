import { FiFileText, FiChevronDown, FiChevronUp } from "react-icons/fi";
import type { FormSubmission } from "@/types/form";
import { useState } from "react";
import { RecursiveJson } from "@/components/ui/recursive/RecursiveJson";

interface SubmissionSummaryProps {
  submission: FormSubmission;
  onResubmit?: () => void;
  resubmitting?: boolean;
  className?: string;
}

const NAME_KEYS = new Set([
  "name",
  "full_name",
  "first_name",
  "submitter_name",
]);

function truncateValue(value: unknown, max = 80): string {
  if (typeof value === "string") {
    return value.length > max ? value.slice(0, max) + "\u2026" : value;
  }
  try {
    const s = JSON.stringify(value);
    return s.length > max ? s.slice(0, max) + "\u2026" : s;
  } catch {
    return String(value);
  }
}

function FormFieldValue({ value }: { value: unknown }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const MAX_LENGTH = 200;

  let content = value;
  if (
    typeof value === "string" &&
    (value.trim().startsWith("{") || value.trim().startsWith("["))
  ) {
    try {
      content = JSON.parse(value);
    } catch {
      /* keep as string */
    }
  }

  if (typeof content === "string") {
    const shouldTruncate = content.length > MAX_LENGTH;
    const displayText =
      shouldTruncate && !isExpanded
        ? content.substring(0, MAX_LENGTH) + "..."
        : content;

    return (
      <div className="mt-1">
        <div className="text-sm text-foreground break-words whitespace-pre-wrap">
          {displayText}
        </div>
        {shouldTruncate && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
          >
            {isExpanded ? (
              <>
                <FiChevronUp className="w-3 h-3" />
                Show less
              </>
            ) : (
              <>
                <FiChevronDown className="w-3 h-3" />
                Show more
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="bg-muted/50 rounded-lg border border-border p-3 font-mono text-xs">
        <RecursiveJson value={content} defaultExpandedDepth={2} />
      </div>
    </div>
  );
}

export function SubmissionSummary({
  submission,
  className = "",
}: SubmissionSummaryProps) {
  const entries = Object.entries(submission.form_data || {});
  const [showAll, setShowAll] = useState(false);

  const displayEntries = entries.filter(
    ([key]) => !NAME_KEYS.has(key.toLowerCase()),
  );
  const previewEntries = displayEntries.slice(0, 4);
  const hasMore = displayEntries.length > 4;

  if (entries.length === 0) return null;

  return (
    <div
      className={`rounded-xl border border-border bg-card shadow-sm ${className}`}
    >
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
            <FiFileText className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold text-primary">
            Submission Summary
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {previewEntries.map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {key.replace(/_/g, " ")}
              </dt>
              <dd className="mt-0.5 text-sm text-foreground truncate">
                {truncateValue(value)}
              </dd>
            </div>
          ))}
        </div>

        {hasMore && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-4 text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
          >
            {showAll ? "Hide answers" : `View all ${displayEntries.length} fields`}
            {showAll ? (
              <FiChevronUp className="h-3 w-3" />
            ) : (
              <FiChevronDown className="h-3 w-3" />
            )}
          </button>
        )}
      </div>

      {showAll && (
        <div className="border-t border-border">
          <dl className="divide-y divide-border">
            {displayEntries.slice(4).map(([key, value]) => (
              <div
                key={key}
                className="px-5 py-4 transition-colors hover:bg-muted/30"
              >
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  {key.replace(/_/g, " ")}
                </dt>
                <dd>
                  <FormFieldValue value={value} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
