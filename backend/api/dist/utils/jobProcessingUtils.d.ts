/**
 * Job processing utilities.
 *
 * Provides utilities for triggering and managing async job processing,
 * supporting both Lambda-based (production) and local (development) execution.
 *
 * @module jobProcessingUtils
 */
/**
 * Job status values.
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
/**
 * Payload for job processing.
 */
export interface JobProcessingPayload {
    [key: string]: unknown;
}
/**
 * Processor function type for local job processing.
 */
export type JobProcessorFunction = (jobId: string, tenantId: string, ...args: unknown[]) => Promise<void>;
/**
 * Utility functions for job processing operations.
 */
export declare class JobProcessingUtils {
    /**
     * Trigger async job processing via Lambda or local processing.
     *
     * In production, invokes a Lambda function asynchronously. In development,
     * processes the job locally using the provided processor function.
     *
     * @param jobId - Job ID to process
     * @param tenantId - Tenant ID (customer ID)
     * @param payload - Payload to send to processor
     * @param processorFunction - Function to call for local processing (development only)
     * @throws {ValidationError} If jobId or tenantId are invalid
     * @throws {Error} If Lambda invocation fails or processor function is missing in local mode
     *
     * @example
     * ```typescript
     * await JobProcessingUtils.triggerAsyncProcessing(
     *   'job-123',
     *   'customer-456',
     *   { workflow_id: 'workflow-789' },
     *   async (jobId, tenantId, ...args) => {
     *     // Local processing logic
     *   }
     * );
     * ```
     */
    static triggerAsyncProcessing(jobId: string, tenantId: string, payload: JobProcessingPayload, processorFunction?: JobProcessorFunction): Promise<void>;
    /**
     * Update job status in the database.
     *
     * Updates the job record with the new status and optional error message.
     * Automatically sets timestamps (started_at for processing, completed_at for completed).
     *
     * @param jobId - Job ID to update
     * @param status - New job status
     * @param errorMessage - Optional error message (for failed jobs)
     * @throws {ValidationError} If jobId is invalid
     * @throws {Error} If database update fails
     *
     * @example
     * ```typescript
     * await JobProcessingUtils.updateJobStatus('job-123', 'processing');
     * await JobProcessingUtils.updateJobStatus('job-123', 'failed', 'Processing error');
     * ```
     */
    static updateJobStatus(jobId: string, status: JobStatus, errorMessage?: string): Promise<void>;
}
//# sourceMappingURL=jobProcessingUtils.d.ts.map