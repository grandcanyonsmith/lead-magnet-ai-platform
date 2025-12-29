"use client";

import { useRouter } from "next/navigation";
import {
  FiChevronDown,
  FiChevronUp,
  FiCopy,
  FiExternalLink,
  FiLoader,
  FiFile,
} from "react-icons/fi";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PreviewRenderer } from "@/components/artifacts/PreviewRenderer";
import { Artifact } from "@/types/artifact";
import toast from "react-hot-toast";
import { useSettings } from "@/hooks/api/useSettings";
import { buildPublicFormUrl } from "@/utils/url";

interface TechnicalDetailsProps {
  job: any;
  form: any | null;
  submission?: any | null;
}

export function TechnicalDetails({
  job,
  form,
  submission,
}: TechnicalDetailsProps) {
  const router = useRouter();
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [copyingAll, setCopyingAll] = useState(false);
  const { settings } = useSettings();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyAllToClipboard = async () => {
    try {
      setCopyingAll(true);
      const parts: string[] = [];

      // Add form submission text
      if (submission?.form_data) {
        parts.push("=== FORM SUBMISSION ===");
        parts.push("");
        Object.entries(submission.form_data).forEach(([key, value]) => {
          const label = key.replace(/_/g, " ");
          const valueStr =
            typeof value === "string" ? value : JSON.stringify(value, null, 2);
          parts.push(`${label}: ${valueStr}`);
        });
        parts.push("");
      }

      // Collect image URLs
      const imageUrls: string[] = [];
      artifacts.forEach((artifact) => {
        const url = artifact.object_url || artifact.public_url;
        const contentType = artifact.content_type || "";
        if (url && contentType.startsWith("image/")) {
          imageUrls.push(url);
        }
      });

      if (imageUrls.length > 0) {
        parts.push("=== IMAGE URLs ===");
        parts.push("");
        imageUrls.forEach((url) => {
          parts.push(url);
        });
        parts.push("");
      }

      // Fetch and add text content from all text-based artifacts
      const textArtifacts = artifacts.filter((artifact) => {
        const contentType = artifact.content_type || "";
        return (
          contentType.startsWith("text/") ||
          contentType === "application/json" ||
          contentType === "text/markdown" ||
          contentType === "text/html" ||
          contentType === "application/xhtml+xml"
        );
      });

      if (textArtifacts.length > 0) {
        parts.push("=== ARTIFACT TEXT CONTENT ===");
        parts.push("");
        for (const artifact of textArtifacts) {
          try {
            const fileName =
              artifact.file_name || artifact.artifact_name || "Artifact";
            parts.push(`--- ${fileName} (${artifact.artifact_id}) ---`);
            const content = await api.getArtifactContent(artifact.artifact_id);
            parts.push(content);
            parts.push("");
          } catch (err) {
            if (process.env.NODE_ENV === "development") {
              console.error(
                `Failed to fetch content for artifact ${artifact.artifact_id}:`,
                err,
              );
            }
            const fileName =
              artifact.file_name || artifact.artifact_name || "Artifact";
            parts.push(`--- ${fileName} (${artifact.artifact_id}) ---`);
            parts.push(`[Error: Could not fetch content]`);
            parts.push("");
          }
        }
      }

      // Copy all combined content
      const allContent = parts.join("\n");
      await navigator.clipboard.writeText(allContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to copy all content:", err);
      }
      // Error already handled by toast in catch block above
      // Still show copied feedback even on error (some content may have been copied)
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setCopyingAll(false);
    }
  };

  // Fetch all artifacts for this job (including images)
  useEffect(() => {
    const fetchArtifacts = async () => {
      if (!job?.job_id || !showTechnicalDetails) return;

      try {
        setLoadingArtifacts(true);
        const response = await api.getArtifacts({
          job_id: job.job_id,
          limit: 100, // Get all artifacts
        });
        setArtifacts(response.artifacts || []);
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.error("Failed to fetch artifacts:", err);
        }
        toast.error("Failed to load artifacts. Please try again.");
        setArtifacts([]);
      } finally {
        setLoadingArtifacts(false);
      }
    };

    fetchArtifacts();
  }, [job?.job_id, showTechnicalDetails]);

  return (
    <div className="mt-4 sm:mt-6 bg-white dark:bg-card rounded-2xl border border-gray-300 dark:border-gray-700 shadow p-4 sm:p-6 ring-1 ring-black/[0.04] dark:ring-white/5">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="flex items-center justify-between flex-1 text-left touch-target"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Technical Details
          </h2>
          {showTechnicalDetails ? (
            <FiChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2" />
          ) : (
            <FiChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2" />
          )}
        </button>
        {showTechnicalDetails && (
          <button
            onClick={copyAllToClipboard}
            disabled={copyingAll}
            className="ml-4 flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target flex-shrink-0"
            title="Copy all artifacts text, image URLs, and form submission to clipboard"
          >
            {copyingAll ? (
              <>
                <FiLoader className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Copying...</span>
              </>
            ) : (
              <>
                <FiCopy className="w-4 h-4" />
                <span className="hidden sm:inline">Copy All</span>
              </>
            )}
          </button>
        )}
      </div>

      {showTechnicalDetails && (
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Job ID
            </label>
            <div className="flex items-center space-x-2">
              <p className="text-sm font-mono text-gray-900 dark:text-gray-200">
                {job.job_id}
              </p>
              <button
                onClick={() => copyToClipboard(job.job_id)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-2 touch-target"
                title="Copy Job ID"
              >
                <FiCopy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {job.submission_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Submission ID
              </label>
              <div className="flex items-center space-x-2">
                {form?.public_slug ? (
                  <a
                    href={buildPublicFormUrl(
                      form.public_slug,
                      settings?.custom_domain,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-mono text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-300 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {job.submission_id}
                    <FiExternalLink className="w-3 h-3 ml-1 inline" />
                  </a>
                ) : (
                  <p className="text-sm font-mono text-gray-900 dark:text-gray-200">
                    {job.submission_id}
                  </p>
                )}
                <button
                  onClick={() => copyToClipboard(job.submission_id)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-2 touch-target"
                  title="Copy Submission ID"
                >
                  <FiCopy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {job.workflow_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Workflow ID
              </label>
              <div className="flex items-center space-x-2">
                <p className="text-sm font-mono text-gray-900 dark:text-gray-200">
                  {job.workflow_id}
                </p>
                <button
                  onClick={() => copyToClipboard(job.workflow_id)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-2 touch-target"
                  title="Copy Workflow ID"
                >
                  <FiCopy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {job.tenant_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tenant ID
              </label>
              <div className="flex items-center space-x-2">
                <p className="text-sm font-mono text-gray-900 dark:text-gray-200">
                  {job.tenant_id}
                </p>
                <button
                  onClick={() => copyToClipboard(job.tenant_id)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-2 touch-target"
                  title="Copy Tenant ID"
                >
                  <FiCopy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {job.started_at && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Started At
              </label>
              <div className="flex items-center space-x-2">
                <p className="text-sm text-gray-900 dark:text-gray-200">
                  {(() => {
                    try {
                      const date = new Date(job.started_at);
                      if (isNaN(date.getTime())) {
                        return job.started_at;
                      }
                      // Format: M/D/YYYY, H:MM:SS AM/PM
                      return date.toLocaleString("en-US", {
                        month: "numeric",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true,
                      });
                    } catch {
                      return job.started_at;
                    }
                  })()}
                </p>
                <button
                  onClick={() => copyToClipboard(job.started_at)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-2 touch-target"
                  title="Copy Started At"
                >
                  <FiCopy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {job.updated_at && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Last Updated
              </label>
              <div className="flex items-center space-x-2">
                <p className="text-sm text-gray-900 dark:text-gray-200">
                  {(() => {
                    try {
                      const date = new Date(job.updated_at);
                      if (isNaN(date.getTime())) {
                        return job.updated_at;
                      }
                      // Format: M/D/YYYY, H:MM:SS AM/PM
                      return date.toLocaleString("en-US", {
                        month: "numeric",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true,
                      });
                    } catch {
                      return job.updated_at;
                    }
                  })()}
                </p>
                <button
                  onClick={() => copyToClipboard(job.updated_at)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-2 touch-target"
                  title="Copy Last Updated"
                >
                  <FiCopy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {(job.artifacts && job.artifacts.length > 0) ||
          artifacts.length > 0 ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Artifacts
              </label>

              {loadingArtifacts ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-4">
                  <FiLoader className="w-4 h-4 animate-spin" />
                  <span>Loading artifacts...</span>
                </div>
              ) : artifacts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                  {artifacts.map((artifact) => {
                    const artifactUrl =
                      artifact.object_url || artifact.public_url;
                    const fileName =
                      artifact.file_name ||
                      artifact.artifact_name ||
                      "Artifact";

                    return (
                      <div
                        key={artifact.artifact_id}
                        className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-card shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="aspect-video bg-gray-100 dark:bg-gray-800">
                          {artifactUrl ? (
                            <PreviewRenderer
                              contentType={artifact.content_type}
                              objectUrl={artifactUrl}
                              fileName={fileName}
                              className="w-full h-full"
                              artifactId={artifact.artifact_id}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                              <FiFile className="w-8 h-8" />
                            </div>
                          )}
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-xs font-medium text-gray-900 dark:text-gray-200 truncate"
                                title={fileName}
                              >
                                {fileName}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() =>
                                  copyToClipboard(
                                    artifactUrl || artifact.artifact_id,
                                  )
                                }
                                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1.5 touch-target"
                                title={
                                  artifactUrl ? "Copy Link" : "Copy Artifact ID"
                                }
                              >
                                <FiCopy className="w-3.5 h-3.5" />
                              </button>
                              {artifactUrl && (
                                <a
                                  href={artifactUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1.5 touch-target"
                                  title="Open in new tab"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <FiExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Fallback: avoid showing raw artifact IDs
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/artifacts")}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                  >
                    <FiExternalLink className="w-4 h-4" />
                    View artifacts
                    {job.artifacts?.length ? ` (${job.artifacts.length})` : ""}
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {job.error_message && job.status === "failed" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Raw Error Details
              </label>
              <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 font-mono text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-all">
                {job.error_message}
              </div>
            </div>
          )}

          {copied && (
            <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-[60]">
              Copied!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
