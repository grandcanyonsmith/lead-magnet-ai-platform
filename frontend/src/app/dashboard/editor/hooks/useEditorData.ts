import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { api } from "@/lib/api";
import type { Job } from "@/types/job";
import type { Workflow } from "@/types/workflow";

interface UseEditorDataProps {
  jobId: string | null;
  initialUrl: string | null;
  artifactId: string | null;
  reset: (html: string) => void;
  setLastSavedHtml: (html: string | null) => void;
  setLastSavedAt: (time: number | null) => void;
  setSelectedElement: (element: string | null) => void;
  setSelectedOuterHtml: (html: string | null) => void;
  setIsSelectionMode: (mode: boolean) => void;
  setHasError: (hasError: boolean) => void;
}

export function useEditorData({
  jobId,
  initialUrl,
  artifactId,
  reset,
  setLastSavedHtml,
  setLastSavedAt,
  setSelectedElement,
  setSelectedOuterHtml,
  setIsSelectionMode,
  setHasError,
}: UseEditorDataProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);

  // Load HTML
  useEffect(() => {
    let isMounted = true;

    const loadContent = async () => {
      if (isMounted) {
        setHasError(false);
      }

      // 1. Try fetching via Artifact ID (best for auth/CORS)
      if (artifactId) {
        try {
          const content = await api.artifacts.getArtifactContent(artifactId);
          if (content && isMounted) {
            reset(content);
            setLastSavedHtml(content);
            setLastSavedAt(Date.now());
            setSelectedElement(null);
            setSelectedOuterHtml(null);
            setIsSelectionMode(false);
            return;
          }
        } catch (err) {
          console.error("Failed to load artifact content:", err);
        }
      }

      // 2. Prefer server-proxied job document (avoids CloudFront/S3 404/CORS issues)
      if (jobId) {
        try {
          const content = await api.jobs.getJobDocument(jobId);
          if (content && isMounted) {
            reset(content);
            setLastSavedHtml(content);
            setLastSavedAt(Date.now());
            setSelectedElement(null);
            setSelectedOuterHtml(null);
            setIsSelectionMode(false);
            return;
          }
        } catch (err) {
          console.error("Failed to load job document:", err);
        }
      }

      // 3. Last resort: fetch the URL directly (may 404 if CloudFront key is stale)
      if (initialUrl) {
        try {
          const res = await fetch(initialUrl);
          if (!res.ok) {
            console.warn(
              `Failed to fetch URL ${initialUrl}: ${res.status} ${res.statusText}`,
            );
            // continue to failure handling below
          } else {
            const content = await res.text();
            if (isMounted) {
              reset(content);
              setLastSavedHtml(content);
              setLastSavedAt(Date.now());
              setSelectedElement(null);
              setSelectedOuterHtml(null);
              setIsSelectionMode(false);
            }
            return;
          }
        } catch (err) {
          console.error("Failed to load initial URL", err);
        }
      }

      // If we got here, all methods failed
      if (isMounted) {
        setHasError(true);
        toast.error("Failed to load content");
      }
    };

    loadContent();

    return () => {
      isMounted = false;
    };
  }, [
    jobId,
    initialUrl,
    artifactId,
    reset,
    setHasError,
    setIsSelectionMode,
    setLastSavedAt,
    setLastSavedHtml,
    setSelectedElement,
    setSelectedOuterHtml,
  ]);

  // Load job metadata for header context
  useEffect(() => {
    let isMounted = true;

    const loadJob = async () => {
      if (!jobId) {
        setJob(null);
        return;
      }
      try {
        const data = await api.getJob(jobId);
        if (isMounted) setJob(data);
      } catch {
        // Non-blocking: editor still works without metadata
      }
    };

    loadJob();
    return () => {
      isMounted = false;
    };
  }, [jobId]);

  // Load workflow (lead magnet) metadata for template actions
  useEffect(() => {
    let isMounted = true;

    const loadWorkflow = async () => {
      const workflowId = job?.workflow_id;
      if (!workflowId) {
        setWorkflow(null);
        return;
      }
      try {
        const wf = await api.getWorkflow(workflowId);
        if (isMounted) setWorkflow(wf as Workflow);
      } catch {
        if (isMounted) setWorkflow(null);
      }
    };

    loadWorkflow();
    return () => {
      isMounted = false;
    };
  }, [job?.workflow_id]);

  return { job, workflow, setJob, setWorkflow };
}
