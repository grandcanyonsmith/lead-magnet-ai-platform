"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobsController = void 0;
const db_1 = require("../utils/db");
const errors_1 = require("../utils/errors");
const artifacts_1 = require("./artifacts");
const ulid_1 = require("ulid");
const logger_1 = require("../utils/logger");
const artifactUrlService_1 = require("../services/artifactUrlService");
const client_s3_1 = require("@aws-sdk/client-s3");
const env_1 = require("../utils/env");
const jobExecutionService_1 = require("../services/jobExecutionService");
const executionStepsUtils_1 = require("../utils/executionStepsUtils");
const JOBS_TABLE = env_1.env.jobsTable;
const SUBMISSIONS_TABLE = env_1.env.submissionsTable;
const ARTIFACTS_BUCKET = env_1.env.artifactsBucket;
const s3Client = new client_s3_1.S3Client({ region: env_1.env.awsRegion });
class JobsController {
    async list(_tenantId, queryParams) {
        const workflowId = queryParams.workflow_id;
        const status = queryParams.status;
        const pageSize = queryParams.limit ? parseInt(queryParams.limit) : undefined;
        const offset = queryParams.offset ? parseInt(queryParams.offset) : 0;
        // Fetch more items than needed to support offset-based pagination
        const fetchLimit = pageSize ? pageSize + offset : undefined;
        const scanPageSize = 200;
        let jobs;
        let totalCount = 0;
        if (workflowId && status) {
            const result = await db_1.db.query(JOBS_TABLE, 'gsi_workflow_status', 'workflow_id = :workflow_id AND #status = :status', { ':workflow_id': workflowId, ':status': status }, { '#status': 'status' }, fetchLimit);
            jobs = result.items;
            // For total count, we'd need a separate query, but for now estimate based on fetched items
            totalCount = jobs.length;
        }
        else if (workflowId) {
            const result = await db_1.db.query(JOBS_TABLE, 'gsi_workflow_status', 'workflow_id = :workflow_id', { ':workflow_id': workflowId }, undefined, fetchLimit);
            jobs = result.items;
            totalCount = jobs.length;
        }
        else {
            // Remove tenant_id filtering - show all jobs from all accounts
            jobs = await db_1.db.scanAll(JOBS_TABLE, scanPageSize, fetchLimit);
            totalCount = jobs.length;
        }
        // Ensure jobs are sorted by created_at DESC (most recent first)
        // db.query already uses ScanIndexForward: false, but add explicit sort as fallback
        jobs.sort((a, b) => {
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateB - dateA; // DESC order
        });
        // Apply offset and limit
        const effectivePageSize = pageSize ?? jobs.length;
        const paginatedJobs = jobs.slice(offset, offset + effectivePageSize);
        const hasMore = jobs.length > offset + effectivePageSize;
        return {
            statusCode: 200,
            body: {
                jobs: paginatedJobs,
                count: paginatedJobs.length,
                total: totalCount,
                offset,
                limit: effectivePageSize,
                has_more: hasMore,
            },
        };
    }
    async get(tenantId, jobId) {
        const job = await db_1.db.get(JOBS_TABLE, { job_id: jobId });
        if (!job) {
            throw new errors_1.ApiError('This generated lead magnet doesn\'t exist', 404);
        }
        // Removed tenant_id check - allow access to all jobs from all accounts
        // Execution steps are ALWAYS stored in S3 (never in DynamoDB).
        // Generate public URL for execution_steps so frontend can fetch them directly from S3.
        // Uses CloudFront URL (non-expiring) if available, otherwise falls back to presigned URL.
        if (job.execution_steps_s3_key) {
            try {
                // Verify S3 file exists before generating URL
                try {
                    const headCommand = new client_s3_1.HeadObjectCommand({
                        Bucket: ARTIFACTS_BUCKET,
                        Key: job.execution_steps_s3_key,
                    });
                    await s3Client.send(headCommand);
                    logger_1.logger.debug(`Verified execution_steps S3 file exists for job ${jobId}`, {
                        s3Key: job.execution_steps_s3_key,
                    });
                }
                catch (s3Error) {
                    if (s3Error.name === 'NotFound' || s3Error.$metadata?.httpStatusCode === 404) {
                        logger_1.logger.warn(`Execution steps S3 file not found for job ${jobId}`, {
                            s3Key: job.execution_steps_s3_key,
                            error: s3Error.message,
                        });
                        // Don't generate URL if file doesn't exist
                    }
                    else {
                        logger_1.logger.error(`Error checking execution steps S3 file for job ${jobId}`, {
                            s3Key: job.execution_steps_s3_key,
                            error: s3Error.message,
                        });
                        // Continue anyway - might be a transient error
                    }
                }
                const executionStepsUrl = await (0, executionStepsUtils_1.generateExecutionStepsUrl)(job.execution_steps_s3_key);
                if (executionStepsUrl) {
                    job.execution_steps_s3_url = executionStepsUrl;
                    const isCloudFront = !artifactUrlService_1.ArtifactUrlService.isPresignedUrl(executionStepsUrl);
                    logger_1.logger.info(`Generated ${isCloudFront ? 'CloudFront' : 'presigned'} URL for execution_steps for job ${jobId}`, {
                        s3Key: job.execution_steps_s3_key,
                        isCloudFront,
                        url: executionStepsUrl.substring(0, 100) + '...', // Log partial URL for debugging
                    });
                }
                else {
                    logger_1.logger.warn(`Failed to generate URL for execution_steps for job ${jobId}`, {
                        s3Key: job.execution_steps_s3_key,
                    });
                }
            }
            catch (error) {
                logger_1.logger.error(`Error processing execution_steps URL for job ${jobId}`, {
                    s3Key: job.execution_steps_s3_key,
                    error: error.message,
                    errorStack: error.stack,
                });
                // Continue without URL - frontend will handle gracefully
            }
        }
        else {
            logger_1.logger.debug(`No execution_steps_s3_key for job ${jobId} - steps may not be created yet`);
        }
        // Refresh output_url from artifacts if job is completed and has artifacts
        // This ensures the URL never expires
        if (job.status === 'completed' && job.artifacts && Array.isArray(job.artifacts) && job.artifacts.length > 0) {
            try {
                // Get the first artifact (usually the final output)
                const artifactId = job.artifacts[job.artifacts.length - 1]; // Get the last artifact (final output)
                if (artifactId) {
                    const artifactResponse = await artifacts_1.artifactsController.get(tenantId, artifactId);
                    if (artifactResponse.body && artifactResponse.body.public_url) {
                        // Update job with fresh URL
                        await db_1.db.update(JOBS_TABLE, { job_id: jobId }, {
                            output_url: artifactResponse.body.public_url,
                            updated_at: new Date().toISOString(),
                        });
                        job.output_url = artifactResponse.body.public_url;
                    }
                }
            }
            catch (error) {
                console.error(`Error refreshing output_url for job ${jobId}:`, error);
                // Continue with existing output_url if refresh fails
            }
        }
        return {
            statusCode: 200,
            body: job,
        };
    }
    /**
     * Get the final document for a job by serving the final artifact content.
     * This endpoint proxies the artifact content to avoid CloudFront redirect issues.
     */
    async getDocument(tenantId, jobId) {
        const job = await db_1.db.get(JOBS_TABLE, { job_id: jobId });
        if (!job) {
            throw new errors_1.ApiError('Job not found', 404);
        }
        if (job.tenant_id !== tenantId) {
            throw new errors_1.ApiError('You don\'t have permission to access this job', 403);
        }
        // Find the final artifact (typically the last one, or one with type 'html_final' or 'markdown_final')
        if (!job.artifacts || !Array.isArray(job.artifacts) || job.artifacts.length === 0) {
            throw new errors_1.ApiError('No artifacts found for this job', 404);
        }
        // Try to find html_final or markdown_final artifact first
        const ARTIFACTS_TABLE = env_1.env.artifactsTable;
        if (!ARTIFACTS_TABLE) {
            throw new errors_1.ApiError('ARTIFACTS_TABLE environment variable is not configured', 500);
        }
        let finalArtifactId = null;
        // Look for html_final or markdown_final artifact (check in reverse order)
        const artifactsReversed = [...job.artifacts].reverse();
        for (const artifactId of artifactsReversed) {
            try {
                const artifact = await db_1.db.get(ARTIFACTS_TABLE, { artifact_id: artifactId });
                if (artifact && (artifact.artifact_type === 'html_final' || artifact.artifact_type === 'markdown_final')) {
                    finalArtifactId = artifactId;
                    break;
                }
            }
            catch (error) {
                logger_1.logger.warn(`Failed to fetch artifact ${artifactId}`, { error });
            }
        }
        // Fallback to last artifact if no final artifact found
        if (!finalArtifactId) {
            finalArtifactId = job.artifacts[job.artifacts.length - 1];
        }
        if (!finalArtifactId) {
            throw new errors_1.ApiError('Final artifact not found', 404);
        }
        // Use artifacts controller to get content
        return await artifacts_1.artifactsController.getContent(tenantId, finalArtifactId);
    }
    async getPublicStatus(jobId) {
        const job = await db_1.db.get(JOBS_TABLE, { job_id: jobId });
        if (!job) {
            throw new errors_1.ApiError('Job not found', 404);
        }
        // Return only public status information (no sensitive data)
        return {
            statusCode: 200,
            body: {
                job_id: job.job_id,
                status: job.status,
                output_url: job.output_url || null,
                error_message: job.error_message || null,
                created_at: job.created_at,
                completed_at: job.completed_at || null,
            },
        };
    }
    async resubmit(_tenantId, jobId) {
        // Get the original job
        const originalJob = await db_1.db.get(JOBS_TABLE, { job_id: jobId });
        if (!originalJob) {
            throw new errors_1.ApiError('This generated lead magnet doesn\'t exist', 404);
        }
        // Removed tenant_id check - allow access to all jobs from all accounts
        // Get the submission data
        if (!originalJob.submission_id) {
            throw new errors_1.ApiError('Cannot resubmit: original submission not found', 400);
        }
        const submission = await db_1.db.get(SUBMISSIONS_TABLE, { submission_id: originalJob.submission_id });
        if (!submission) {
            throw new errors_1.ApiError('Cannot resubmit: submission data not found', 404);
        }
        // Removed tenant_id check - allow access to all jobs from all accounts
        // Create a new submission record (copy of the original)
        const newSubmissionId = `sub_${(0, ulid_1.ulid)()}`;
        const newSubmission = {
            submission_id: newSubmissionId,
            tenant_id: submission.tenant_id,
            form_id: submission.form_id,
            workflow_id: submission.workflow_id,
            submission_data: submission.submission_data,
            submitter_ip: submission.submitter_ip || null,
            submitter_email: submission.submitter_email || null,
            submitter_phone: submission.submitter_phone || null,
            submitter_name: submission.submitter_name || null,
            created_at: new Date().toISOString(),
            ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 days
        };
        await db_1.db.put(SUBMISSIONS_TABLE, newSubmission);
        // Create new job record
        const newJobId = `job_${(0, ulid_1.ulid)()}`;
        const newJob = {
            job_id: newJobId,
            tenant_id: originalJob.tenant_id,
            workflow_id: originalJob.workflow_id,
            submission_id: newSubmissionId,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        await db_1.db.put(JOBS_TABLE, newJob);
        // Update submission with job_id
        await db_1.db.update(SUBMISSIONS_TABLE, { submission_id: newSubmissionId }, { job_id: newJobId });
        // Start job processing
        await jobExecutionService_1.jobExecutionService.startJobProcessing({
            jobId: newJobId,
            tenantId: originalJob.tenant_id,
            workflowId: originalJob.workflow_id,
            submissionId: newSubmissionId,
        });
        return {
            statusCode: 200,
            body: {
                job_id: newJobId,
                status: 'pending',
                message: 'Job resubmitted successfully',
            },
        };
    }
}
exports.jobsController = new JobsController();
//# sourceMappingURL=jobs.js.map