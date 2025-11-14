import { exec } from 'child_process';
import { promisify } from 'util';
import { db } from '../utils/db';
import { logger } from '../utils/logger';
import { env } from '../utils/env';

const execAsync = promisify(exec);

const JOBS_TABLE = env.jobsTable;

/**
 * Process a job locally by calling the Python worker script
 */
export async function processJobLocally(
  jobId: string,
  _tenantId: string,
  _workflowId: string,
  _submissionId: string
): Promise<void> {
  logger.info('[Local Job Processor] Starting local job processing', { jobId });

  try {
    // Update job status to processing
    await db.update(JOBS_TABLE, { job_id: jobId }, {
      status: 'processing',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Try to call Python worker script if it exists
    const workerPath = env.workerScriptPath;
    
    try {
      // Set JOB_ID environment variable and run worker
      const { stdout, stderr } = await execAsync(`JOB_ID=${jobId} python3 ${workerPath}`, {
        cwd: process.cwd(),
        env: { ...process.env, JOB_ID: jobId },
        timeout: 300000, // 5 minute timeout
      });
      
      logger.info('[Local Job Processor] Worker completed', { jobId, stdout, stderr });
    } catch (execError: any) {
      // If Python worker fails, log and mark as failed
      logger.error('[Local Job Processor] Worker execution failed', {
        jobId,
        error: execError.message,
        stderr: execError.stderr,
      });
      
      await db.update(JOBS_TABLE, { job_id: jobId }, {
        status: 'failed',
        error_message: `Worker execution failed: ${execError.message}`,
        updated_at: new Date().toISOString(),
      });
      
      throw execError;
    }
  } catch (error: any) {
    logger.error('[Local Job Processor] Error processing job', {
      jobId,
      error: error.message,
      errorStack: error.stack,
    });
    
    // Update job status to failed
    await db.update(JOBS_TABLE, { job_id: jobId }, {
      status: 'failed',
      error_message: `Processing failed: ${error.message}`,
      updated_at: new Date().toISOString(),
    });
    
    throw error;
  }
}

