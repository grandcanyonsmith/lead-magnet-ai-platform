import { exec } from 'child_process';
import { promisify } from 'util';
import { resolve, dirname, isAbsolute } from 'path';
import { db } from '../utils/db';
import { logger } from '../utils/logger';
import { env } from '../utils/env';

const execAsync = promisify(exec);

const JOBS_TABLE = env.jobsTable;

/**
 * Resolve worker script path relative to project root.
 * Works whether running from root or backend/api directory.
 */
function resolveWorkerPath(workerPath: string): string {
  // If path is absolute, use as-is
  if (isAbsolute(workerPath)) {
    return workerPath;
  }
  
  // Get the project root (where backend/ folder is)
  // __dirname in compiled JS will be backend/api/dist/services
  // So we need to go up: services -> dist -> api -> backend -> project root
  const servicesDir = __dirname; // backend/api/dist/services
  const distDir = dirname(servicesDir); // backend/api/dist
  const apiDir = dirname(distDir); // backend/api
  const backendDir = dirname(apiDir); // backend
  const projectRoot = dirname(backendDir); // project root (where backend/ folder is)
  
  // Resolve worker path relative to project root
  // workerPath is like './backend/worker/worker.py'
  return resolve(projectRoot, workerPath);
}

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

    // Resolve worker script path relative to project root
    const workerPath = resolveWorkerPath(env.workerScriptPath);
    const workerDir = dirname(workerPath);
    
    logger.info('[Local Job Processor] Resolved worker path', { 
      jobId, 
      workerPath,
      workerDir,
      cwd: process.cwd()
    });
    
    try {
      // Set JOB_ID environment variable and run worker
      // Run from worker directory so Python imports work correctly
      const { stdout, stderr } = await execAsync(`python3 ${workerPath}`, {
        cwd: workerDir,
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

