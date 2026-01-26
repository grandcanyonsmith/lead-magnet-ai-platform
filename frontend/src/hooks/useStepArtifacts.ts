/**
 * Hook for fetching and organizing artifacts by step order
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import { Artifact } from "@/types/artifact";
import { MergedStep } from "@/types/job";

interface UseStepArtifactsOptions {
  jobId?: string;
  steps: MergedStep[];
  enabled?: boolean;
}

/**
 * Fetch and organize artifacts by step order
 */
export function useStepArtifacts(options: UseStepArtifactsOptions) {
  const { jobId, steps, enabled = true } = options;
  const isEnabled = enabled !== false;
  
  const [imageArtifactsByStep, setImageArtifactsByStep] = useState<
    Map<number, Artifact[]>
  >(new Map());
  
  const [fileArtifactsByStep, setFileArtifactsByStep] = useState<
    Map<number, Artifact[]>
  >(new Map());

  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(false);

  // Use ref to track the last jobId we fetched artifacts for
  const lastFetchedJobIdRef = useRef<string | undefined>(undefined);
  // Use ref to access latest steps without re-triggering effects on array reference changes
  const stepsRef = useRef<MergedStep[]>(steps);

  // Create a stable reference for steps by serializing key properties
  const stepsKey = useMemo(() => {
    if (!isEnabled) return "";
    if (!steps || steps.length === 0) return "";
    return steps.map((s) => `${s.step_order}-${s.started_at || ""}`).join(",");
  }, [steps, isEnabled]);

  // Keep steps ref updated
  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  // Fetch artifacts only when jobId changes
  useEffect(() => {
    const fetchArtifacts = async () => {
      if (!isEnabled) return;
      if (!jobId) return;

      // Skip if we already fetched artifacts for this jobId
      if (lastFetchedJobIdRef.current === jobId) {
        return;
      }

      try {
        setLoading(true);
        setArtifacts([]);
        setImageArtifactsByStep(new Map());
        setFileArtifactsByStep(new Map());
        
        const response = await api.getArtifacts({
          job_id: jobId,
          limit: 200,
        });

        const allArtifacts = response.artifacts || [];
        setArtifacts(allArtifacts);
        lastFetchedJobIdRef.current = jobId;
      } catch (error) {
        console.error("Failed to fetch artifacts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchArtifacts();
  }, [jobId, isEnabled]);

  useEffect(() => {
    if (!isEnabled && loading) {
      setLoading(false);
    }
  }, [isEnabled, loading]);

  // Re-organize artifacts by step when steps change (but don't re-fetch)
  useEffect(() => {
    if (!isEnabled) return;
    const currentSteps = stepsRef.current || [];
    if (artifacts.length === 0 || currentSteps.length === 0) {
      setImageArtifactsByStep(new Map());
      setFileArtifactsByStep(new Map());
      return;
    }

    const imagesMap = new Map<number, Artifact[]>();
    const filesMap = new Map<number, Artifact[]>();

    // Sort steps by step_order for matching
    const sortedSteps = [...currentSteps].sort((a, b) => {
      const orderA = a.step_order ?? 0;
      const orderB = b.step_order ?? 0;
      return orderA - orderB;
    });

    artifacts.forEach((artifact: Artifact) => {
      const type =
        artifact.artifact_type?.toLowerCase() ||
        artifact.content_type?.toLowerCase() ||
        "";
      const isImage = type.includes("image");
      
      // Skip internal logs artifacts if they are just JSON logs (we render them inline now)
      // But keep them if they are explicitly files user might want to download
      // For now, let's include everything that isn't an image in filesMap
      
      let stepOrder: number | null = null;

      // Try to extract step order from filename
      const fileName = artifact.file_name || artifact.artifact_name || "";
      const stepMatch = fileName.match(/step[_\s](\d+)/i);

      if (stepMatch) {
        stepOrder = parseInt(stepMatch[1], 10);
      } else {
        // Fallback: try to match by timestamp proximity to step execution
        if (artifact.created_at) {
          const artifactTime = new Date(artifact.created_at).getTime();

          for (const step of sortedSteps) {
            if (step.started_at) {
              const stepTime = new Date(step.started_at).getTime();
              const timeDiff = Math.abs(artifactTime - stepTime);

              // If artifact was created within 5 minutes of step execution, associate it
              if (timeDiff < 5 * 60 * 1000) {
                stepOrder = step.step_order ?? 0;
                break;
              }
            }
          }
        }
      }

      if (stepOrder !== null) {
        const targetMap = isImage ? imagesMap : filesMap;
        if (!targetMap.has(stepOrder)) {
          targetMap.set(stepOrder, []);
        }
        targetMap.get(stepOrder)!.push(artifact);
      }
    });

    setImageArtifactsByStep(imagesMap);
    setFileArtifactsByStep(filesMap);
  }, [artifacts, stepsKey, isEnabled]);

  return {
    imageArtifactsByStep,
    fileArtifactsByStep,
    artifacts,
    loading,
  };
}
