import {
  FiCopy,
  FiRefreshCw,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";
import { Menu, Transition } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import type { FormSubmission } from "@/types/form";
import toast from "react-hot-toast";
import { Fragment, useState } from "react";

interface SubmissionSummaryProps {
  submission: FormSubmission;
  onResubmit: () => void;
  resubmitting: boolean;
  className?: string;
}

function JsonValue({ value, depth = 0 }: { value: any; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2); // Auto-expand first 2 levels

  if (value === null || value === undefined) {
    return <span className="text-gray-400 italic">null</span>;
  }

  if (typeof value === "string") {
    // Check if it's a JSON string that should be parsed
    if (value.trim().startsWith("{") || value.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(value);
        return <JsonValue value={parsed} depth={depth} />;
      } catch {
        // Not valid JSON, display as string
      }
    }
    return <span className="text-gray-900 dark:text-gray-200">{value}</span>;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return <span className="text-blue-600 dark:text-blue-400 font-medium">{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-gray-400 italic">[]</span>;
    }

    return (
      <div className="mt-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-1"
        >
          {expanded ? (
            <FiChevronUp className="w-3 h-3" />
          ) : (
            <FiChevronDown className="w-3 h-3" />
          )}
          <span className="text-xs font-medium">
            Array ({value.length} items)
          </span>
        </button>
        {expanded && (
          <div className="ml-4 mt-1 space-y-2 border-l-2 border-gray-200 dark:border-gray-700 pl-3">
            {value.map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="text-gray-400 text-xs font-mono">{idx}:</span>
                <div className="flex-1">
                  <JsonValue value={item} depth={depth + 1} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <span className="text-gray-400 italic">{"{}"}</span>;
    }

    return (
      <div className="mt-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-1"
        >
          {expanded ? (
            <FiChevronUp className="w-3 h-3" />
          ) : (
            <FiChevronDown className="w-3 h-3" />
          )}
          <span className="text-xs font-medium">
            Object ({entries.length} fields)
          </span>
        </button>
        {expanded && (
          <div className="ml-4 mt-1 space-y-2 border-l-2 border-gray-200 dark:border-gray-700 pl-3">
            {entries.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-purple-600 dark:text-purple-400 text-xs font-medium">
                  {k}:
                </span>
                <div className="flex-1">
                  <JsonValue value={v} depth={depth + 1} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return <span className="text-gray-600 dark:text-gray-400">{String(value)}</span>;
}

function FormFieldValue({ value }: { value: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const MAX_LENGTH = 200;

  // If it's a simple string, display it directly
  if (
    typeof value === "string" &&
    !value.trim().startsWith("{") &&
    !value.trim().startsWith("[")
  ) {
    const shouldTruncate = value.length > MAX_LENGTH;
    const displayText =
      shouldTruncate && !isExpanded
        ? value.substring(0, MAX_LENGTH) + "..."
        : value;

    return (
      <div className="mt-1">
        <div className="text-sm text-gray-900 dark:text-gray-200 break-words whitespace-pre-wrap">
          {displayText}
        </div>
        {shouldTruncate && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium flex items-center gap-1"
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

  // For complex values, use JSON viewer
  return (
    <div className="mt-2">
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-3 font-mono text-xs">
        <JsonValue value={value} />
      </div>
    </div>
  );
}

export function SubmissionSummary({
  submission,
  onResubmit,
  resubmitting,
  className = "",
}: SubmissionSummaryProps) {
  const entries = Object.entries(submission.form_data || {});
  const [showAnswers, setShowAnswers] = useState(false);

  // Extract name if available for display
  const nameField = entries.find(([key]) =>
    ["name", "full_name", "first_name", "submitter_name"].includes(
      key.toLowerCase(),
    ),
  );
  const displayName = nameField ? String(nameField[1]) : null;

  const handleCopyAll = async () => {
    try {
      const text = JSON.stringify(submission.form_data, null, 2);
      if (navigator?.clipboard) {
        await navigator.clipboard.writeText(text);
        toast.success("Submission copied to clipboard");
      } else {
        throw new Error("Clipboard not available");
      }
    } catch {
      toast.error("Unable to copy submission");
    }
  };

  return (
    <section className={`mb-4 sm:mb-6 ${className}`}>
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-card shadow-sm overflow-visible">
        <div className="flex flex-col gap-3 p-4 sm:p-6 md:flex-row md:items-center md:justify-between bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/50 dark:to-transparent">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Form Submission
            </p>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {displayName || "Submitted Answers"}
            </h2>
          </div>
          <div className="flex w-full items-center justify-end gap-2 md:w-auto">
            <Menu as="div" className="relative inline-flex w-full justify-end text-left md:w-auto">
              <Menu.Button
                aria-label="Submission actions"
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 text-gray-600 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
              >
                <EllipsisVerticalIcon className="h-5 w-5" />
              </Menu.Button>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
              <Menu.Items className="absolute right-0 mt-2 w-52 max-w-[calc(100vw-2rem)] origin-top-right divide-y divide-gray-100 dark:divide-gray-800 rounded-lg bg-white dark:bg-gray-900 shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none z-50">
                  <div className="px-1 py-1">
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          type="button"
                          onClick={() => setShowAnswers((v) => !v)}
                          className={`group flex w-full items-center rounded-md px-2 py-2 text-sm transition-colors ${
                            active
                              ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                              : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {showAnswers ? (
                            <FiChevronUp className="mr-2 h-4 w-4" />
                          ) : (
                            <FiChevronDown className="mr-2 h-4 w-4" />
                          )}
                          {showAnswers ? "Hide answers" : "View answers"}
                        </button>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          type="button"
                          onClick={handleCopyAll}
                          className={`group flex w-full items-center rounded-md px-2 py-2 text-sm transition-colors ${
                            active
                              ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                              : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          <FiCopy className="mr-2 h-4 w-4" />
                          Copy all
                        </button>
                      )}
                    </Menu.Item>
                    <Menu.Item disabled={resubmitting}>
                      {({ active, disabled }) => (
                        <button
                          type="button"
                          onClick={onResubmit}
                          disabled={disabled}
                          className={`group flex w-full items-center rounded-md px-2 py-2 text-sm transition-colors ${
                            disabled
                              ? "text-gray-400 dark:text-gray-500 cursor-not-allowed"
                              : active
                                ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                                : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          <FiRefreshCw
                            className={`mr-2 h-4 w-4 ${resubmitting ? "animate-spin" : ""}`}
                          />
                          Resubmit
                        </button>
                      )}
                    </Menu.Item>
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        </div>
        {showAnswers && (
          <div className="border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-card overflow-hidden">
            {entries.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                No submission data available
              </p>
            ) : (
              <dl className="divide-y divide-gray-100 dark:divide-gray-800">
                {entries.map(([key, value]) => {
                  const isComplex =
                    typeof value !== "string" ||
                    value.trim().startsWith("{") ||
                    value.trim().startsWith("[");

                  return (
                    <div
                      key={key}
                      className={`px-4 py-4 sm:px-6 sm:py-5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${isComplex ? "bg-gray-50/50 dark:bg-gray-800/30" : ""}`}
                    >
                      <dt className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 capitalize">
                        {key
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </dt>
                      <dd>
                        <FormFieldValue value={value} />
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
