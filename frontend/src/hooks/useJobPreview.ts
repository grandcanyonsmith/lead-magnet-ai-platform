/**
 * Hook for fetching and caching job output previews
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import type { Job } from "@/types/job";
import type { Artifact } from "@/types/artifact";

export interface JobPreview {
  url: string | null;
  contentType: string | null;
  isLoading: boolean;
  error: string | null;
  triggerFetch?: () => void;
}

// Global cache to avoid refetching the same job's preview
const previewCache = new Map<string, JobPreview>();

/**
 * Get preview URL for a job
 * Priority: first image artifact > job.output_url > null
 */
export function useJobPreview(
  job: Job | null | undefined,
  options: {
    enabled?: boolean;
    lazy?: boolean; // Only fetch on hover/visibility
  } = {},
): JobPreview {
  const { enabled = true, lazy = false } = options;
  const [preview, setPreview] = useState<JobPreview>(() => {
    if (!job?.job_id) {
      return { url: null, contentType: null, isLoading: false, error: null };
    }
    // Check cache first
    const cached = previewCache.get(job.job_id);
    if (cached) {
      return cached;
    }
    return { url: null, contentType: null, isLoading: false, error: null };
  });

  const [shouldFetch, setShouldFetch] = useState(!lazy);
  const fetchingRef = useRef<Set<string>>(new Set());

  const fetchPreview = useCallback(
    async (jobId: string, outputUrl?: string | null) => {
      // Prevent duplicate fetches
      if (fetchingRef.current.has(jobId)) {
        return;
      }

      // Check cache again (might have been populated by another component)
      const cached = previewCache.get(jobId);
      if (cached && cached.url !== null) {
        setPreview(cached);
        return;
      }

      fetchingRef.current.add(jobId);

      try {
        setPreview((prev) => ({ ...prev, isLoading: true, error: null }));

        // Try to fetch artifacts first
        const artifactsResponse = await api.getArtifacts({
          job_id: jobId,
          limit: 10, // Get first 10 artifacts to find an image
        });

        const artifacts = artifactsResponse.artifacts || [];

        // Find first image artifact
        const imageArtifact = artifacts.find((artifact: Artifact) => {
          const type =
            artifact.artifact_type?.toLowerCase() ||
            artifact.content_type?.toLowerCase() ||
            "";
          return type.includes("image");
        });

        let previewUrl: string | null = null;
        let contentType: string | null = null;

        if (imageArtifact) {
          previewUrl =
            imageArtifact.object_url ||
            imageArtifact.public_url ||
            null;
          contentType =
            imageArtifact.content_type ||
            imageArtifact.mime_type ||
            "image/png";
        } else if (outputUrl) {
          // Fallback to job.output_url if available
          previewUrl = outputUrl;
          contentType = null; // We don't know the content type from output_url alone
        }

        const result: JobPreview = {
          url: previewUrl,
          contentType,
          isLoading: false,
          error: null,
        };

        previewCache.set(jobId, result);
        setPreview(result);
      } catch (error) {
        // On error, fallback to output_url if available
        const result: JobPreview = {
          url: outputUrl || null,
          contentType: null,
          isLoading: false,
          error: null, // Don't show error if we have a fallback
        };
        previewCache.set(jobId, result);
        setPreview(result);
      } finally {
        fetchingRef.current.delete(jobId);
      }
    },
    [],
  );

  // Update preview URL from job.output_url if no artifact found
  useEffect(() => {
    if (!job?.job_id || !enabled || !shouldFetch) return;

    const cached = previewCache.get(job.job_id);
    if (cached?.url) {
      // Already have a preview
      return;
    }

    // If we have output_url but no preview yet, use it as immediate fallback
    if (job.output_url && !cached) {
      const result: JobPreview = {
        url: job.output_url,
        contentType: null, // We don't know the content type from output_url alone
        isLoading: false,
        error: null,
      };
      previewCache.set(job.job_id, result);
      setPreview(result);
    }

    // Fetch artifacts to find image preview (will override output_url if image found)
    if (!cached || cached.url === null) {
      fetchPreview(job.job_id, job.output_url);
    }
  }, [job?.job_id, job?.output_url, enabled, shouldFetch, fetchPreview]);

  // Reset when job changes
  useEffect(() => {
    if (!job?.job_id) {
      setPreview({ url: null, contentType: null, isLoading: false, error: null });
      setShouldFetch(!lazy);
      return;
    }

    const cached = previewCache.get(job.job_id);
    if (cached) {
      setPreview(cached);
    } else if (job.output_url && !lazy) {
      // Immediate fallback to output_url (only if not lazy)
      const result: JobPreview = {
        url: job.output_url,
        contentType: null,
        isLoading: false,
        error: null,
      };
      previewCache.set(job.job_id, result);
      setPreview(result);
    }
  }, [job?.job_id, lazy]);

  const triggerFetch = useCallback(() => {
    if (lazy && !shouldFetch && job?.job_id) {
      setShouldFetch(true);
    }
  }, [lazy, shouldFetch, job?.job_id]);

  return {
    ...preview,
    ...(lazy ? { triggerFetch } : {}), // Only expose triggerFetch if lazy mode
  } as JobPreview;
}

