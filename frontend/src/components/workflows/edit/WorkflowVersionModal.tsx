"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AlertBanner } from "@/components/ui/AlertBanner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/AlertDialog";
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
  const [pendingRestoreVersion, setPendingRestoreVersion] = useState<number | null>(null);
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

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
      >
        <DialogContent className="max-w-2xl p-0">
          <DialogHeader className="border-b border-border bg-card px-6 py-4 text-left">
            <DialogTitle className="pr-8 text-lg font-semibold text-foreground">
              Version History
            </DialogTitle>
            <DialogDescription className="mt-1 pr-8 text-xs text-muted-foreground">
              Track and restore previous lead magnet configurations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-6">
            {loading && (
              <div className="text-sm text-muted-foreground">
                Loading versions...
              </div>
            )}
            {error && (
              <AlertBanner variant="error" className="p-3" description={error} />
            )}

            {!loading && !error && versions.length === 0 && (
              <div className="text-sm text-muted-foreground">
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
                    className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 px-4 py-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          v{version.version}
                        </span>
                        {isCurrent && (
                          <Badge variant="success">Current</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Saved {formatTimestamp(version.created_at)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {version.step_count} steps ·{" "}
                        {version.template_version
                          ? `template v${version.template_version}`
                          : "no template version"}
                      </div>
                    </div>

                    {!isCurrent && (
                      <Button
                        variant="outline"
                        size="sm"
                        isLoading={restoringVersion === version.version}
                        onClick={() => setPendingRestoreVersion(version.version)}
                      >
                        Restore
                      </Button>
                    )}
                  </div>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingRestoreVersion !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRestoreVersion(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Restore version
              {pendingRestoreVersion !== null ? ` v${pendingRestoreVersion}` : ""}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new version using the selected workflow settings so
              you can safely roll back if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRestoreVersion !== null) {
                  void handleRestore(pendingRestoreVersion);
                }
                setPendingRestoreVersion(null);
              }}
            >
              Restore version
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
