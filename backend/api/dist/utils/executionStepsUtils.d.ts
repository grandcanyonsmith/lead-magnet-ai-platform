/**
 * Execution steps utilities.
 *
 * Provides utilities for generating URLs for execution steps stored in S3.
 *
 * @module executionStepsUtils
 */
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
export declare function generateExecutionStepsUrl(s3Key: string): Promise<string | null>;
//# sourceMappingURL=executionStepsUtils.d.ts.map