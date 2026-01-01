import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export function useRunSelection(workflowId?: string) {
  const [availableRuns, setAvailableRuns] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [selectedRunLoading, setSelectedRunLoading] = useState(false);
  const [selectedRunError, setSelectedRunError] = useState<string | null>(null);
  const [selectedRunVars, setSelectedRunVars] = useState<any>(null);

  // Load recent completed runs for this workflow
  useEffect(() => {
    if (!workflowId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await api.getJobs({
          workflow_id: workflowId,
          status: "completed",
          limit: 20,
        });
        if (cancelled) return;
        setAvailableRuns(res?.jobs || []);
      } catch (_err) {
        if (cancelled) return;
        setAvailableRuns([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  // When a run is selected, fetch its execution steps
  useEffect(() => {
    if (!selectedRunId) {
      setSelectedRunVars(null);
      setSelectedRunError(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setSelectedRunLoading(true);
      setSelectedRunError(null);
      try {
        const executionSteps = await api.getExecutionSteps(selectedRunId);
        const runMeta = (availableRuns || []).find(
          (j: any) => j.job_id === selectedRunId,
        );

        const workflowSteps = (
          Array.isArray(executionSteps) ? executionSteps : []
        )
          .filter((s: any) => {
            const orderOk =
              typeof s?.step_order === "number" && s.step_order > 0;
            const typeOk =
              s?.step_type === "ai_generation" ||
              s?.step_type === "webhook" ||
              s?.step_type === "html_generation" ||
              s?.step_type === "workflow_step";
            return orderOk && typeOk;
          })
          .sort((a: any, b: any) => (a.step_order || 0) - (b.step_order || 0));

        const artifactIds = workflowSteps
          .map((s: any) => s?.artifact_id)
          .filter((id: any) => typeof id === "string" && id.trim().length > 0);

        const artifactRecords = await Promise.all(
          artifactIds.map(async (artifactId: string) => {
            try {
              return await api.getArtifact(artifactId);
            } catch {
              return null;
            }
          }),
        );

        const artifactUrlById = new Map<string, string>();
        artifactRecords.forEach((a: any) => {
          if (!a?.artifact_id) return;
          const url = a.public_url || a.object_url || a.url;
          if (url) artifactUrlById.set(a.artifact_id, String(url));
        });

        const runSteps = workflowSteps.map((s: any) => {
          const outputText =
            typeof s?.output === "string"
              ? s.output
              : s?.output !== undefined && s?.output !== null
                ? JSON.stringify(s.output)
                : "";
          const imageUrls = Array.isArray(s?.image_urls)
            ? s.image_urls.filter(Boolean).map(String)
            : [];
          const artifactId =
            typeof s?.artifact_id === "string" ? s.artifact_id : null;
          const artifactUrl = artifactId
            ? artifactUrlById.get(artifactId) || null
            : null;
          const artifactUrls = Array.from(
            new Set([...(artifactUrl ? [artifactUrl] : []), ...imageUrls]),
          );
          return {
            step_order: s?.step_order,
            step_name: s?.step_name,
            step_type: s?.step_type,
            output: outputText,
            artifact_id: artifactId,
            artifact_url: artifactUrl,
            artifact_urls: artifactUrls,
            image_urls: imageUrls,
          };
        });

        const vars = {
          job: {
            job_id: selectedRunId,
            workflow_id: runMeta?.workflow_id,
            status: runMeta?.status,
            created_at: runMeta?.created_at,
            output_url: runMeta?.output_url,
          },
          steps: runSteps,
        };

        if (cancelled) return;
        setSelectedRunVars(vars);
      } catch (err: any) {
        if (cancelled) return;
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load run data";
        setSelectedRunError(msg);
        setSelectedRunVars(null);
      } finally {
        if (cancelled) return;
        setSelectedRunLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedRunId, availableRuns]);

  return {
    availableRuns,
    selectedRunId,
    setSelectedRunId,
    selectedRunLoading,
    selectedRunError,
    selectedRunVars,
  };
}
