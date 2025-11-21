"use strict";
/**
 * Execution steps utilities.
 *
 * Provides utilities for generating URLs for execution steps stored in S3.
 *
 * @module executionStepsUtils
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateExecutionStepsUrl = generateExecutionStepsUrl;
const artifactUrlService_1 = require("../services/artifactUrlService");
const logger_1 = require("./logger");
const validators_1 = require("./validators");
const errorHandling_1 = require("./errorHandling");
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
async function generateExecutionStepsUrl(s3Key) {
    try {
        (0, validators_1.validateNonEmptyString)(s3Key, 's3Key');
    }
    catch (error) {
        logger_1.logger.warn('[Execution Steps Utils] Invalid S3 key provided', {
            s3Key,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
    return (0, errorHandling_1.safeReturn)(async () => {
        logger_1.logger.debug('[Execution Steps Utils] Generating URL for execution steps', { s3Key });
        // Use ArtifactUrlService to get CloudFront URL (non-expiring) or long-lived presigned URL
        const { url } = await artifactUrlService_1.ArtifactUrlService.generateUrl(s3Key);
        logger_1.logger.debug('[Execution Steps Utils] Successfully generated URL', {
            s3Key,
            urlLength: url.length
        });
        return url;
    }, true);
}
//# sourceMappingURL=executionStepsUtils.js.map