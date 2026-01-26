"use client";

import { useRouter } from "next/navigation";
import {
  FiCopy,
  FiExternalLink,
  FiLoader,
  FiFile,
} from "react-icons/fi";
import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { PreviewRenderer } from "@/components/artifacts/PreviewRenderer";
import { Artifact } from "@/types/artifact";
import toast from "react-hot-toast";
import { useSettings } from "@/hooks/api/useSettings";
import { buildPublicFormUrl } from "@/utils/url";
import { SectionCard } from "@/components/ui/SectionCard";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { buildExecutionJsonSummary } from "@/utils/jobs/rawExecutionJson";

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
  const [copied, setCopied] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [copyingAll, setCopyingAll] = useState(false);
  const { settings } = useSettings();
  const rawJsonData = useMemo(() => buildExecutionJsonSummary(job), [job]);
  const hasRawJson = Array.isArray(rawJsonData)
    ? rawJsonData.length > 0
    : Boolean(rawJsonData);
  const { rawJsonString, rawJsonError } = useMemo(() => {
    if (!hasRawJson) {
      return { rawJsonString: "", rawJsonError: false };
    }
    try {
      return {
        rawJsonString: JSON.stringify(rawJsonData, null, 2),
        rawJsonError: false,
      };
    } catch {
      return { rawJsonString: "", rawJsonError: true };
    }
  }, [rawJsonData, hasRawJson]);

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

  const handleCopyRawJson = async () => {
    if (!rawJsonString) return;
    try {
      await navigator.clipboard.writeText(rawJsonString);
      toast.success("Execution JSON copied");
    } catch {
      toast.error("Unable to copy JSON");
    }
  };

  // Fetch all artifacts for this job (including images)
  useEffect(() => {
    const fetchArtifacts = async () => {
      if (!job?.job_id) return;

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
  }, [job?.job_id]);

  const formatTimestamp = (value?: string | null) => {
    if (!value) return "—";
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return value;
      }
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
      return value;
    }
  };

  return (
    <SectionCard
      title="Technical details"
      description="Reference identifiers, artifacts, and raw execution data."
      actions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyAllToClipboard}
            disabled={copyingAll}
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
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <SectionCard title="Identifiers" padding="sm">
          <KeyValueList
            items={[
              {
                label: "Job ID",
                value: job.job_id,
                copyValue: job.job_id,
              },
              job.submission_id
                ? {
                    label: "Submission ID",
                    value: form?.public_slug ? (
                      <a
                        href={buildPublicFormUrl(
                          form.public_slug,
                          settings?.custom_domain,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700"
                      >
                        {job.submission_id}
                        <FiExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      job.submission_id
                    ),
                    copyValue: job.submission_id,
                  }
                : null,
              job.workflow_id
                ? {
                    label: "Workflow ID",
                    value: job.workflow_id,
                    copyValue: job.workflow_id,
                  }
                : null,
              job.tenant_id
                ? {
                    label: "Tenant ID",
                    value: job.tenant_id,
                    copyValue: job.tenant_id,
                  }
                : null,
            ].filter(Boolean) as any}
            onCopy={copyToClipboard}
            columns={2}
            dense
          />
        </SectionCard>

        <SectionCard title="Timing" padding="sm">
          <KeyValueList
            items={[
              {
                label: "Created",
                value: formatTimestamp(job.created_at),
                copyValue: job.created_at,
              },
              job.started_at
                ? {
                    label: "Started",
                    value: formatTimestamp(job.started_at),
                    copyValue: job.started_at,
                  }
                : null,
              job.updated_at
                ? {
                    label: "Last updated",
                    value: formatTimestamp(job.updated_at),
                    copyValue: job.updated_at,
                  }
                : null,
            ].filter(Boolean) as any}
            onCopy={copyToClipboard}
            columns={2}
            dense
          />
        </SectionCard>

        {(job.artifacts && job.artifacts.length > 0) || artifacts.length > 0 ? (
          <SectionCard title="Artifacts" padding="sm">
            {loadingArtifacts ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <FiLoader className="w-4 h-4 animate-spin" />
                <span>Loading artifacts...</span>
              </div>
            ) : artifacts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {artifacts.map((artifact) => {
                  const artifactUrl =
                    artifact.object_url || artifact.public_url;
                  const fileName =
                    artifact.file_name || artifact.artifact_name || "Artifact";

                  return (
                    <Card
                      key={artifact.artifact_id}
                      className="overflow-hidden"
                    >
                      <div className="aspect-video bg-muted/40">
                        {artifactUrl ? (
                          <PreviewRenderer
                            contentType={artifact.content_type}
                            objectUrl={artifactUrl}
                            fileName={fileName}
                            className="w-full h-full"
                            artifactId={artifact.artifact_id}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <FiFile className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                      <div className="p-3 bg-muted/20 border-t border-border">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-xs font-medium text-foreground truncate"
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
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
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
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="Open in new tab"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <FiExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/dashboard/artifacts")}
                >
                  <FiExternalLink className="w-4 h-4" />
                  View artifacts
                  {job.artifacts?.length ? ` (${job.artifacts.length})` : ""}
                </Button>
              </div>
            )}
          </SectionCard>
        ) : null}

        {job.error_message && job.status === "failed" && (
          <SectionCard title="Errors" padding="sm">
            <div className="bg-muted/30 rounded-lg p-4 font-mono text-xs text-foreground whitespace-pre-wrap break-words">
              {job.error_message}
            </div>
          </SectionCard>
        )}

        <SectionCard
          title="Raw execution JSON"
          description="Filtered execution steps (instructions, tools, step info, outputs)."
          padding="sm"
          actions={
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCopyRawJson}
              disabled={!rawJsonString}
              title={rawJsonString ? "Copy execution JSON" : "No JSON data to copy"}
            >
              <FiCopy className="w-4 h-4" />
              Copy JSON
            </Button>
          }
        >
          {rawJsonError ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              Unable to render raw JSON for this run.
            </div>
          ) : hasRawJson ? (
            <JsonViewer
              value={rawJsonData}
              raw={rawJsonString}
              defaultMode="tree"
              defaultExpandedDepth={2}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              No raw JSON data is available for this run.
            </div>
          )}
        </SectionCard>

        {copied && (
          <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-[60]">
            Copied!
          </div>
        )}
      </div>
    </SectionCard>
  );
}
