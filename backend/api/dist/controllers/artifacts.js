"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.artifactsController = void 0;
const db_1 = require("../utils/db");
const errors_1 = require("../utils/errors");
const artifactUrlService_1 = require("../services/artifactUrlService");
const logger_1 = require("../utils/logger");
const client_s3_1 = require("@aws-sdk/client-s3");
const env_1 = require("../utils/env");
const ARTIFACTS_TABLE = env_1.env.artifactsTable;
const JOBS_TABLE = env_1.env.jobsTable;
const ARTIFACTS_BUCKET = env_1.env.artifactsBucket;
if (!ARTIFACTS_TABLE) {
    logger_1.logger.error('[Artifacts Controller] ARTIFACTS_TABLE environment variable is not set');
}
if (!ARTIFACTS_BUCKET) {
    throw new Error('ARTIFACTS_BUCKET environment variable is required');
}
const s3Client = new client_s3_1.S3Client({ region: env_1.env.awsRegion });
class ArtifactsController {
    async list(_tenantId, queryParams) {
        if (!ARTIFACTS_TABLE) {
            throw new errors_1.ApiError('ARTIFACTS_TABLE environment variable is not configured', 500);
        }
        const jobId = queryParams.job_id;
        const artifactType = queryParams.artifact_type;
        const limit = queryParams.limit ? parseInt(queryParams.limit) : undefined;
        const scanPageSize = 200; // Reasonable page size for full-table scans
        let artifactsResult;
        if (jobId) {
            artifactsResult = await db_1.db.query(ARTIFACTS_TABLE, 'gsi_job_id', 'job_id = :job_id', { ':job_id': jobId }, undefined, limit);
        }
        else if (artifactType) {
            // Remove tenant_id filtering - show all artifacts from all accounts
            const allArtifacts = await db_1.db.scanAll(ARTIFACTS_TABLE, scanPageSize);
            const filteredByType = allArtifacts.filter((a) => a.artifact_type === artifactType);
            artifactsResult = { items: limit ? filteredByType.slice(0, limit) : filteredByType };
        }
        else {
            // Remove tenant_id filtering - show all artifacts from all accounts
            artifactsResult = { items: await db_1.db.scanAll(ARTIFACTS_TABLE, scanPageSize, limit) };
        }
        let artifacts = (0, db_1.normalizeQueryResult)(artifactsResult);
        // Filter out report.md artifacts - they're for internal use only
        artifacts = artifacts.filter((artifact) => {
            const fileName = artifact.artifact_name || artifact.file_name || '';
            return !fileName.includes('report.md') && artifact.artifact_type !== 'report_markdown';
        });
        // Fetch workflow_id for artifacts that have job_id
        // Collect unique job_ids
        const jobIds = new Set();
        artifacts.forEach((artifact) => {
            if (artifact.job_id) {
                jobIds.add(artifact.job_id);
            }
        });
        // Batch fetch jobs to get workflow_ids
        const jobIdToWorkflowId = new Map();
        if (jobIds.size > 0 && JOBS_TABLE) {
            try {
                await Promise.all(Array.from(jobIds).map(async (jobId) => {
                    try {
                        const job = await db_1.db.get(JOBS_TABLE, { job_id: jobId });
                        if (job && job.workflow_id) {
                            jobIdToWorkflowId.set(jobId, job.workflow_id);
                        }
                    }
                    catch (error) {
                        logger_1.logger.warn(`Failed to fetch workflow_id for job ${jobId}`, { error, job_id: jobId });
                    }
                }));
            }
            catch (error) {
                logger_1.logger.error('Error batch fetching workflow_ids', { error });
            }
        }
        // Sort by created_at DESC (most recent first)
        artifacts.sort((a, b) => {
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateB - dateA; // DESC order
        });
        // Ensure all artifacts have accessible URLs and include workflow_id
        // Use CloudFront URLs (non-expiring) when available, fallback to presigned URLs
        const artifactsWithUrls = await Promise.all(artifacts.map(async (artifact) => {
            const workflowId = artifact.job_id ? jobIdToWorkflowId.get(artifact.job_id) : undefined;
            if (!artifact.s3_key) {
                return {
                    ...artifact,
                    object_url: artifact.public_url || null,
                    file_name: artifact.artifact_name || artifact.file_name,
                    size_bytes: artifact.file_size_bytes ? parseInt(artifact.file_size_bytes) : artifact.size_bytes,
                    content_type: artifact.mime_type || artifact.content_type, // Map mime_type to content_type for frontend
                    workflow_id: workflowId, // Include workflow_id from job lookup
                };
            }
            try {
                const objectUrl = await artifactUrlService_1.ArtifactUrlService.ensureValidUrl(artifact);
                return {
                    ...artifact,
                    object_url: objectUrl,
                    public_url: objectUrl,
                    file_name: artifact.artifact_name || artifact.file_name,
                    size_bytes: artifact.file_size_bytes ? parseInt(artifact.file_size_bytes) : artifact.size_bytes,
                    content_type: artifact.mime_type || artifact.content_type, // Map mime_type to content_type for frontend
                    workflow_id: workflowId, // Include workflow_id from job lookup
                };
            }
            catch (error) {
                logger_1.logger.error(`Error generating URL for artifact ${artifact.artifact_id}`, { error, artifact_id: artifact.artifact_id });
                return {
                    ...artifact,
                    object_url: artifact.public_url || null,
                    file_name: artifact.artifact_name || artifact.file_name,
                    size_bytes: artifact.file_size_bytes ? parseInt(artifact.file_size_bytes) : artifact.size_bytes,
                    content_type: artifact.mime_type || artifact.content_type, // Map mime_type to content_type for frontend
                    workflow_id: workflowId, // Include workflow_id from job lookup
                };
            }
        }));
        return {
            statusCode: 200,
            body: {
                artifacts: artifactsWithUrls,
                count: artifactsWithUrls.length,
            },
        };
    }
    async get(_tenantId, artifactId) {
        if (!ARTIFACTS_TABLE) {
            throw new errors_1.ApiError('ARTIFACTS_TABLE environment variable is not configured', 500);
        }
        const artifact = await db_1.db.get(ARTIFACTS_TABLE, { artifact_id: artifactId });
        if (!artifact) {
            throw new errors_1.ApiError('This file doesn\'t exist', 404);
        }
        // Removed tenant_id check - allow access to all artifacts from all accounts
        // Don't allow access to report.md files through the API
        const fileName = artifact.artifact_name || artifact.file_name || '';
        if (fileName.includes('report.md') || artifact.artifact_type === 'report_markdown') {
            throw new errors_1.ApiError('This file is not available for download', 404);
        }
        // Generate URL if missing, expired, or is a presigned URL (replace with CloudFront)
        if (artifact.s3_key) {
            artifact.public_url = await artifactUrlService_1.ArtifactUrlService.ensureValidUrl(artifact);
        }
        // Map mime_type to content_type for frontend consistency (same as list endpoint)
        const artifactResponse = {
            ...artifact,
            object_url: artifact.public_url || artifact.object_url || null,
            file_name: artifact.artifact_name || artifact.file_name,
            size_bytes: artifact.file_size_bytes ? parseInt(artifact.file_size_bytes) : artifact.size_bytes,
            content_type: artifact.mime_type || artifact.content_type, // Map mime_type to content_type for frontend
        };
        return {
            statusCode: 200,
            body: artifactResponse,
        };
    }
    /**
     * Get artifact content by fetching directly from S3.
     * This endpoint proxies the artifact content to avoid presigned URL expiration issues.
     */
    async getContent(_tenantId, artifactId) {
        if (!ARTIFACTS_TABLE) {
            throw new errors_1.ApiError('ARTIFACTS_TABLE environment variable is not configured', 500);
        }
        const artifact = await db_1.db.get(ARTIFACTS_TABLE, { artifact_id: artifactId });
        if (!artifact) {
            throw new errors_1.ApiError('Artifact not found', 404);
        }
        // Removed tenant_id check - allow access to all artifacts from all accounts
        if (!artifact.s3_key) {
            throw new errors_1.ApiError('Artifact S3 key not found', 404);
        }
        try {
            // Log the S3 key being requested for debugging
            logger_1.logger.info(`Fetching artifact content from S3`, {
                artifactId,
                s3Key: artifact.s3_key,
                bucket: ARTIFACTS_BUCKET,
            });
            const command = new client_s3_1.GetObjectCommand({
                Bucket: ARTIFACTS_BUCKET,
                Key: artifact.s3_key,
            });
            const response = await s3Client.send(command);
            if (!response.Body) {
                throw new errors_1.ApiError(`S3 object body is empty for key: ${artifact.s3_key}`, 500);
            }
            const content = await response.Body.transformToString();
            const contentType = response.ContentType || artifact.mime_type || 'text/plain';
            // For HTML content, add CORS headers and proper content type
            const headers = {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
            };
            // For HTML documents, ensure proper charset
            if (contentType.includes('text/html')) {
                headers['Content-Type'] = 'text/html; charset=utf-8';
            }
            return {
                statusCode: 200,
                body: content,
                headers,
            };
        }
        catch (error) {
            if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
                logger_1.logger.error(`Artifact file not found in S3`, {
                    artifactId,
                    s3Key: artifact.s3_key,
                    bucket: ARTIFACTS_BUCKET,
                    errorName: error.name,
                    httpStatusCode: error.$metadata?.httpStatusCode,
                });
                // Try to check if file exists with HeadObject for better error message
                try {
                    const headCommand = new client_s3_1.HeadObjectCommand({
                        Bucket: ARTIFACTS_BUCKET,
                        Key: artifact.s3_key,
                    });
                    await s3Client.send(headCommand);
                }
                catch (headError) {
                    logger_1.logger.error(`Confirmed file does not exist in S3`, {
                        artifactId,
                        s3Key: artifact.s3_key,
                        bucket: ARTIFACTS_BUCKET,
                        headError: headError.message,
                    });
                }
                throw new errors_1.ApiError(`Artifact file not found in S3. Key: ${artifact.s3_key}`, 404);
            }
            logger_1.logger.error(`Error fetching artifact content for ${artifactId}`, {
                s3Key: artifact.s3_key,
                bucket: ARTIFACTS_BUCKET,
                error: error.message,
                errorName: error.name,
                httpStatusCode: error.$metadata?.httpStatusCode,
            });
            throw new errors_1.ApiError(`Failed to fetch artifact content: ${error.message}`, 500);
        }
    }
}
exports.artifactsController = new ArtifactsController();
//# sourceMappingURL=artifacts.js.map