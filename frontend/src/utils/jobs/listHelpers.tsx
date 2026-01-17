import type { ReactNode } from "react";
import { FiCheckCircle, FiLoader, FiXCircle } from "react-icons/fi";

export const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: "Queued",
    processing: "Generating",
    completed: "Ready",
    failed: "Error",
  };
  return labels[status] || status;
};

export const getStatusIcon = (status: string): ReactNode => {
  switch (status) {
    case "completed":
      return <FiCheckCircle className="w-5 h-5 text-green-600" />;
    case "failed":
      return <FiXCircle className="w-5 h-5 text-red-600" />;
    case "processing":
      return <FiLoader className="w-5 h-5 text-yellow-600 animate-spin" />;
    case "pending":
      return <FiCheckCircle className="w-5 h-5 text-yellow-600" />;
    default:
      return <FiCheckCircle className="w-5 h-5 text-yellow-600" />;
  }
};

export const getStatusBadge = (status: string): ReactNode => {
  const colors: Record<string, string> = {
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    processing: "bg-yellow-100 text-yellow-800",
    pending: "bg-yellow-100 text-yellow-800",
  };
  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || "bg-gray-100 text-gray-800"}`}
    >
      {getStatusLabel(status)}
    </span>
  );
};

export const getStatusDot = (status: string): ReactNode => {
  const normalized = typeof status === "string" ? status.toLowerCase() : "";
  const colors: Record<string, string> = {
    completed: "bg-emerald-500",
    failed: "bg-red-500",
    processing: "bg-amber-400",
    pending: "bg-amber-400",
  };
  const label = getStatusLabel(normalized || status);

  return (
    <span
      className={`inline-flex h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/30 ${colors[normalized] || "bg-gray-400"}`}
      role="img"
      aria-label={label}
      title={label}
    />
  );
};

// Check if a step has completed (matches the logic from components/jobs/utils.ts and useMergedSteps.ts)
function hasCompleted(step: any): boolean {
  // Check explicit status first (most reliable)
  if (step._status === "completed") {
    return true;
  }

  // Check for explicit output
  if (step.output !== null && step.output !== undefined && step.output !== "") {
    return true;
  }

  // Check for completion timestamp
  if (step.completed_at) {
    return true;
  }

  // Check for duration (indicates step ran)
  if (step.duration_ms !== undefined && step.duration_ms !== null) {
    return true;
  }

  // Check for artifact (output artifact exists)
  if (step.artifact_id) {
    return true;
  }

  // Check for image URLs (images were generated)
  if (
    step.image_urls &&
    Array.isArray(step.image_urls) &&
    step.image_urls.length > 0
  ) {
    return true;
  }

  // Check if step has started and completed timestamps
  if (step.started_at && step.completed_at) {
    return true;
  }

  return false;
}

export const getStepProgress = (job: any) => {
  const steps = job.execution_steps || [];
  if (steps.length === 0) return null;

  // Count all completed steps (matching useMergedSteps logic)
  // A step is completed if it has output (matching useMergedSteps line 59-60)
  let completedSteps = 0;

  // Sort steps by order to process in sequence
  const sortedSteps = [...steps].sort((a, b) => {
    const orderA = a.step_order ?? 0;
    const orderB = b.step_order ?? 0;
    return orderA - orderB;
  });

  for (let i = 0; i < sortedSteps.length; i++) {
    const step = sortedSteps[i];

    // Stop counting if we hit a failed step
    if (step._status === "failed") {
      break;
    }

    // Match useMergedSteps logic: step is completed if it has output
    // This matches the detail page which uses mergedSteps with _status='completed' for steps with output
    const hasOutput =
      step.output !== null && step.output !== undefined && step.output !== "";

    if (hasOutput) {
      completedSteps++;
    } else if (job.status === "failed") {
      // If job failed and step has no output, stop counting
      break;
    }
  }

  return { completed: completedSteps, total: steps.length };
};

export const getStepDisplayMeta = (
  job: any,
  workflowStepCounts: Record<string, number>,
): { label: string | null; isActive: boolean } => {
  const progress = getStepProgress(job);
  const workflowTotal = workflowStepCounts[job.workflow_id];
  const progressTotal =
    progress?.total && progress.total > 0 ? progress.total : 0;
  const totalSteps = workflowTotal || progressTotal || 0;
  const isActive = job.status === "processing" || job.status === "pending";

  if (totalSteps > 0) {
    if (isActive) {
      const completed = progress?.completed ?? 0;
      // Show completed count to match detail page (which shows completed/total)
      // The detail page shows how many steps have completed, not the current step number
      const displayCount = completed > 0 ? completed : 1;
      return { label: `Step ${displayCount}/${totalSteps}`, isActive };
    }
    if (progress) {
      const safeCompleted = Math.min(progress.completed, totalSteps);
      return { label: `Step ${safeCompleted}/${totalSteps}`, isActive };
    }
    return { label: `Step ${totalSteps}/${totalSteps}`, isActive };
  }

  if (progress && progress.total > 0) {
    return { label: `Step ${progress.completed}/${progress.total}`, isActive };
  }

  return { label: null, isActive };
};

/**
 * Extract a preview string from submission form data.
 * Tries common fields like name, email, company, etc.
 */
export const getSubmissionPreview = (submission: any): string | null => {
  if (!submission) return null;

  const formData = submission.form_data || submission.submission_data || {};

  // Try common identifier fields in order of preference
  const identifierFields = [
    "name",
    "full_name",
    "first_name",
    "email",
    "company",
    "company_name",
    "organization",
    "title",
    "job_title",
  ];

  for (const field of identifierFields) {
    const value = formData[field];
    if (value && typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  // If no common field found, try to get first non-empty string value
  for (const [key, value] of Object.entries(formData)) {
    if (typeof value === "string" && value.trim() && value.trim().length > 0) {
      return value.trim();
    }
  }

  // Fallback to submission_id if available
  if (submission.submission_id) {
    return submission.submission_id.substring(0, 8) + "...";
  }

  return null;
};

/**
 * Get submission preview from job.
 * Specifically looks for the "name" field from form submission data.
 */
export const getJobSubmissionPreview = (job: any): string | null => {
  // Check for submission_preview from backend (includes submitter_name, submitter_email, etc.)
  if (job.submission_preview) {
    const preview = job.submission_preview;

    // Prefer submitter_name if available (this is the name field from the form)
    if (
      preview.submitter_name &&
      typeof preview.submitter_name === "string" &&
      preview.submitter_name.trim()
    ) {
      return preview.submitter_name.trim();
    }

    // Check form_data_preview for "name" field specifically
    // Backend now prioritizes name fields first in form_data_preview
    if (preview.form_data_preview) {
      // Look for "name" field first (case-insensitive check)
      const nameFields = [
        "name",
        "Name",
        "full_name",
        "first_name",
        "Full_Name",
        "First_Name",
      ];
      for (const field of nameFields) {
        const value = preview.form_data_preview[field];
        if (value && typeof value === "string" && value.trim()) {
          return value.trim();
        }
      }

      // Also check all keys case-insensitively for "name"
      for (const [key, value] of Object.entries(preview.form_data_preview)) {
        if (
          key.toLowerCase() === "name" &&
          value &&
          typeof value === "string" &&
          value.trim()
        ) {
          return value.trim();
        }
      }

      // Fallback to first field value if it's a string
      const firstValue = Object.values(preview.form_data_preview)[0];
      if (firstValue && typeof firstValue === "string" && firstValue.trim()) {
        return firstValue.trim();
      }
    }

    // Fallback to submitter_email
    if (
      preview.submitter_email &&
      typeof preview.submitter_email === "string" &&
      preview.submitter_email.trim()
    ) {
      return preview.submitter_email.trim();
    }
  }

  // If job has submission data directly (from detail page)
  if (job.submission) {
    // Check submitter_name first
    if (
      job.submission.submitter_name &&
      typeof job.submission.submitter_name === "string" &&
      job.submission.submitter_name.trim()
    ) {
      return job.submission.submitter_name.trim();
    }

    // Then check form_data or submission_data
    const formData =
      job.submission.form_data || job.submission.submission_data || {};
    if (
      formData.name &&
      typeof formData.name === "string" &&
      formData.name.trim()
    ) {
      return formData.name.trim();
    }
    // Check other name field variations
    const nameFields = [
      "full_name",
      "first_name",
      "Name",
      "Full_Name",
      "First_Name",
    ];
    for (const field of nameFields) {
      if (
        formData[field] &&
        typeof formData[field] === "string" &&
        formData[field].trim()
      ) {
        return formData[field].trim();
      }
    }
    // Fallback to general preview
    const preview = getSubmissionPreview(job.submission);
    if (preview) return preview;
  }

  // Fallback to submission_id (only if no name found)
  if (job.submission_id) {
    return `Submission ${job.submission_id.substring(0, 8)}...`;
  }

  return null;
};
