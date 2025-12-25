import toast from "react-hot-toast";
import { api } from "@/lib/api";

export type OpenJobDocumentResult =
  | "opened"
  | "popup_blocked"
  | "fallback_opened"
  | "error";

export interface OpenJobDocumentOptions {
  /**
   * If provided, we will open this URL in a new tab when secure blob-viewer fails.
   * Useful when you already have `output_url` and want a best-effort fallback.
   */
  fallbackUrl?: string;
  /**
   * How long to wait before revoking the blob URL.
   */
  revokeAfterMs?: number;
  /**
   * Provide a string to show a success toast, or set to false/undefined to skip.
   */
  successToast?: string | false;
}

function getUserFacingErrorMessage(error: unknown): string {
  const raw =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message)
      : "";
  const message = raw.toLowerCase();

  if (raw.includes("404") || message.includes("not found")) {
    return "Document not found. It may not have been generated yet.";
  }

  if (
    raw.includes("403") ||
    message.includes("forbidden") ||
    message.includes("permission")
  ) {
    return "You do not have permission to view this document.";
  }

  if (raw.includes("401") || message.includes("unauthorized")) {
    return "Your session has expired. Please sign in again.";
  }

  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("timeout")
  ) {
    return "Network error. Please check your connection and try again.";
  }

  return "Failed to open document. Please try again.";
}

export async function openJobDocumentInNewTab(
  jobId: string,
  options: OpenJobDocumentOptions = {},
): Promise<OpenJobDocumentResult> {
  if (!jobId) {
    toast.error("Job ID is missing.");
    return "error";
  }

  if (typeof window === "undefined") {
    return "error";
  }

  const { fallbackUrl, revokeAfterMs = 5000, successToast } = options;
  let blobUrl: string | null = null;

  try {
    blobUrl = await api.getJobDocumentBlobUrl(jobId);

    if (!blobUrl) {
      throw new Error("Failed to create blob URL");
    }

    const newWindow = window.open(blobUrl, "_blank", "noopener,noreferrer");

    if (
      !newWindow ||
      newWindow.closed ||
      typeof newWindow.closed === "undefined"
    ) {
      toast.error(
        "Popup blocked. Please allow popups for this site and try again.",
      );
      URL.revokeObjectURL(blobUrl);
      return "popup_blocked";
    }

    window.setTimeout(() => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    }, revokeAfterMs);

    if (successToast) {
      toast.success(successToast);
    }

    return "opened";
  } catch (error: unknown) {
    if (fallbackUrl) {
      window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      toast.error(
        "Could not open via secure viewer — opened direct link instead.",
      );
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
      return "fallback_opened";
    }

    toast.error(getUserFacingErrorMessage(error));
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
    }
    return "error";
  }
}
