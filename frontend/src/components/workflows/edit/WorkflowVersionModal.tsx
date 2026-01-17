"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { WorkflowVersionSummary } from "@/types";

interface WorkflowVersionModalProps {
  isOpen: boolean;
  workflowId: string;
  currentVersion: number;
  onClose: () => void;
  onRestored?: () => void | Promise<void>;
}

const formatTimestamp = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export function WorkflowVersionModal({
  isOpen,
  workflowId,
  currentVersion,
  onClose,
  onRestored,
}: WorkflowVersionModalProps) {
  const [versions, setVersions] = useState<WorkflowVersionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    if (!workflowId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.getWorkflowVersions(workflowId);
      setVersions(response.versions || []);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load versions",
      );
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    if (isOpen) {
      void loadVersions();
    }
  }, [isOpen, loadVersions]);

  const handleRestore = async (version: number) => {
    if (!workflowId) return;
    if (
      !confirm(
        `Restore lead magnet to version v${version}? This will create a new version with the restored settings.`,
      )
    ) {
      return;
    }

    setRestoringVersion(version);
    try {
      await api.restoreWorkflowVersion(workflowId, version);
      toast.success(`Restored to version v${version}`);
      await loadVersions();
      await onRestored?.();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to restore version",
      );
    } finally {
      setRestoringVersion(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />
        <div className="relative z-50 w-full max-w-2xl rounded-xl bg-white dark:bg-card shadow-xl border border-gray-200 dark:border-border">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-border px-6 py-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground">
                Version History
              </h3>
              <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">
                Track and restore previous lead magnet configurations.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>

          <div className="p-6 space-y-4">
            {loading && (
              <div className="text-sm text-gray-500 dark:text-muted-foreground">
                Loading versions...
              </div>
            )}
            {error && (
              <div className="rounded-md border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-200">
                {error}
              </div>
            )}

            {!loading && !error && versions.length === 0 && (
              <div className="text-sm text-gray-500 dark:text-muted-foreground">
                No versions found yet.
              </div>
            )}

            {!loading &&
              !error &&
              versions.map((version) => {
                const isCurrent = version.version === currentVersion;
                return (
                  <div
                    key={version.version}
                    className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 dark:border-border bg-gray-50/60 dark:bg-secondary/40 px-4 py-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-foreground">
                          v{version.version}
                        </span>
                        {isCurrent && (
                          <Badge variant="success">Current</Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-muted-foreground">
                        Saved {formatTimestamp(version.created_at)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-muted-foreground">
                        {version.step_count} steps ·{" "}
                        {version.template_version
                          ? `template v${version.template_version}`
                          : "no template version"}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isCurrent && (
                        <Button
                          variant="outline"
                          size="sm"
                          isLoading={restoringVersion === version.version}
                          onClick={() => handleRestore(version.version)}
                        >
                          Restore
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
