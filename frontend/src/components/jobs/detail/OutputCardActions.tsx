"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";
import { FiLoader } from "react-icons/fi";
import { api } from "@/lib/api";

interface OutputCardActionsProps {
  url: string;
  artifactId?: string;
  contentType?: string;
}

async function fetchArtifactBlob(
  artifactId: string,
  contentType?: string,
): Promise<Blob> {
  const text = await api.artifacts.getArtifactContent(artifactId);
  const mimeType = contentType || "application/octet-stream";
  return new Blob([text], { type: mimeType });
}

async function fetchArtifactText(artifactId: string): Promise<string> {
  return api.artifacts.getArtifactContent(artifactId);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTextDocument(text: string, mimeType?: string): string {
  const safeText = escapeHtml(text);
  const label =
    mimeType === "application/json"
      ? "JSON output"
      : mimeType === "text/markdown"
        ? "Markdown output"
        : "Text output";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${label}</title>
    <style>
      body {
        margin: 0;
        background: #0b1020;
        color: #e5ecff;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }
      main {
        max-width: 1200px;
        margin: 0 auto;
        padding: 24px;
      }
      h1 {
        font: 600 18px/1.3 system-ui, sans-serif;
        margin: 0 0 16px;
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
        line-height: 1.55;
        background: #11182c;
        border: 1px solid #24304d;
        border-radius: 12px;
        padding: 16px;
        overflow: auto;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${label}</h1>
      <pre>${safeText}</pre>
    </main>
  </body>
</html>`;
}

export function OutputCardActions({
  url,
  artifactId,
  contentType,
}: OutputCardActionsProps) {
  const [opening, setOpening] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleCopy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        throw new Error("Clipboard API not available");
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Unable to copy link");
    }
  };

  const handleOpen = async (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (!artifactId) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    const popup = window.open("", "_blank", "noopener,noreferrer");
    setOpening(true);
    try {
      if (popup) {
        popup.document.write("<p style='font-family: sans-serif; padding: 16px;'>Opening file…</p>");
      }
      const text = await fetchArtifactText(artifactId);
      if (popup) {
        popup.document.open();
        if (contentType === "text/html") {
          popup.document.write(text);
        } else {
          popup.document.write(renderTextDocument(text, contentType));
        }
        popup.document.close();
      } else {
        const blob = new Blob(
          [contentType === "text/html" ? text : renderTextDocument(text, contentType)],
          { type: "text/html" },
        );
        const blobUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = blobUrl;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      }
    } catch {
      popup?.close();
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setOpening(false);
    }
  };

  const handleDownload = async (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (!artifactId) {
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      a.click();
      return;
    }
    setDownloading(true);
    try {
      const blob = await fetchArtifactBlob(artifactId, contentType);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const filename = url.split("/").pop()?.split("?")[0] || "download";
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch {
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      a.click();
    } finally {
      setDownloading(false);
    }
  };

  const btnClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors";

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={handleCopy}
        className={btnClass}
        aria-label="Copy link"
      >
        <ClipboardDocumentIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={handleOpen}
        disabled={opening}
        className={btnClass}
        aria-label="Open link"
      >
        {opening ? (
          <FiLoader className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
        )}
      </button>
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className={btnClass}
        aria-label="Download file"
      >
        {downloading ? (
          <FiLoader className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowDownTrayIcon className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
