/**
 * Execution steps utilities.
 *
 * Provides utilities for generating URLs for execution steps stored in S3.
 *
 * @module executionStepsUtils
 */

import { ArtifactUrlService } from "../services/artifactUrlService";
import { logger } from "./logger";
import { validateNonEmptyString } from "./validators";
import { safeReturn } from "./errorHandling";

/**
 * Generate a public URL for execution_steps stored in S3.
 *
 * Execution steps are always stored in S3 (never in DynamoDB) to ensure
 * complete data storage without size limitations.
 *
 * Uses CloudFront URL (non-expiring) if available, otherwise falls back to
 * a long-lived presigned URL. This ensures execution steps are always accessible.
 *
 * @param s3Key - S3 key for the execution_steps JSON file
 * @returns Public URL string or null if generation fails
 * @throws {ValidationError} If s3Key is invalid
 *
 * @example
 * ```typescript
 * const url = await generateExecutionStepsUrl('jobs/123/execution_steps.json');
 * if (url) {
 *   console.log('Execution steps URL:', url);
 * }
 * ```
 */
export async function generateExecutionStepsUrl(
  s3Key: string,
): Promise<string | null> {
  try {
    validateNonEmptyString(s3Key, "s3Key");
  } catch (error) {
    logger.warn("[Execution Steps Utils] Invalid S3 key provided", {
      s3Key,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  return safeReturn(async () => {
    logger.debug("[Execution Steps Utils] Generating URL for execution steps", {
      s3Key,
    });

    // Use ArtifactUrlService to get CloudFront URL (non-expiring) or long-lived presigned URL
    const { url } = await ArtifactUrlService.generateUrl(s3Key);

    logger.debug("[Execution Steps Utils] Successfully generated URL", {
      s3Key,
      urlLength: url.length,
    });

    return url;
  }, true);
}
