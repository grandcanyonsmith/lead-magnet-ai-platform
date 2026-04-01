import { toast } from "sonner";
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
   * Provide a string to show a success toast, or set to false/undefined to skip.
   */
  successToast?: string | false;
  /**
   * Show a loading toast while fetching the document. Defaults to true.
   */
  showLoadingToast?: boolean;
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

/**
 * Opens a job document in a new tab with improved popup blocker handling.
 * Uses a hybrid approach: tries to open a window immediately, then navigates it.
 * Falls back to anchor click if window.open is blocked.
 */
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

  const {
    fallbackUrl,
    successToast,
    showLoadingToast = true,
  } = options;

  // Show loading feedback immediately
  const loadingToastId = showLoadingToast
    ? toast.loading("Opening document...")
    : null;

  // Open a window synchronously (before any await) to avoid popup blockers.
  // Must NOT use "noopener" here — blob URLs are scoped to the browsing
  // context group, and noopener creates a separate group that cannot
  // resolve blob: origins.  We null-out opener after navigation instead.
  const loadingWindow = window.open("about:blank", "_blank");
  const windowWasBlocked = !loadingWindow || loadingWindow.closed || typeof loadingWindow.closed === "undefined";

  // Set up loading content in the window if we successfully opened it
  if (!windowWasBlocked) {
    try {
      loadingWindow.document.title = "Opening document…";
      loadingWindow.document.body.innerHTML = `
        <div style="
          font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        ">
          <div style="
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            padding: 2rem;
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          ">
            <div style="
              width: 48px;
              height: 48px;
              border: 4px solid rgba(255, 255, 255, 0.3);
              border-top-color: white;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin: 0 auto 1rem;
            "></div>
            <h1 style="margin: 0 0 0.5rem; font-size: 1.5rem; font-weight: 600;">
              Preparing your document…
            </h1>
            <p style="margin: 0; opacity: 0.9; font-size: 0.95rem;">
              Please wait while we load the content
            </p>
          </div>
        </div>
        <style>
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      `;
    } catch {
      // Ignore - cross-origin restrictions may prevent this
    }
  }

  try {
    const html = await api.getJobDocument(jobId);

    if (!html) {
      throw new Error("Document is empty");
    }

    if (!windowWasBlocked && loadingWindow) {
      try {
        loadingWindow.document.open();
        loadingWindow.document.write(html);
        loadingWindow.document.close();
        try { loadingWindow.opener = null; } catch { /* cross-origin */ }
      } catch {
        loadingWindow.close();
        throw new Error("Failed to render document in new tab");
      }
    } else {
      const popup = window.open("", "_blank");
      if (popup) {
        popup.document.open();
        popup.document.write(html);
        popup.document.close();
        try { popup.opener = null; } catch { /* cross-origin */ }
      } else {
        throw new Error("Popup blocked");
      }
    }

    if (loadingToastId) {
      toast.dismiss(loadingToastId);
    }

    if (successToast) {
      toast.success(successToast);
    }

    return "opened";
  } catch (error: unknown) {
    if (loadingToastId) {
      toast.dismiss(loadingToastId);
    }

    if (!windowWasBlocked && loadingWindow) {
      try {
        loadingWindow.close();
      } catch {
        // Ignore
      }
    }

    if (fallbackUrl) {
      const link = document.createElement("a");
      link.href = fallbackUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.error(
        "Could not open via secure viewer — opened direct link instead.",
      );
      return "fallback_opened";
    }

    toast.error(getUserFacingErrorMessage(error));
    return "error";
  }
}
