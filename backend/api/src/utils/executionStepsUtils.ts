import { ArtifactUrlService } from '../services/artifactUrlService';
import { logger } from '../utils/logger';

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
 */
export async function generateExecutionStepsUrl(s3Key: string): Promise<string | null> {
  try {
    // Use ArtifactUrlService to get CloudFront URL (non-expiring) or long-lived presigned URL
    const { url } = await ArtifactUrlService.generateUrl(s3Key);
    return url;
  } catch (error) {
    logger.error(`Error generating URL for execution_steps: ${s3Key}`, error);
    return null;
  }
}

