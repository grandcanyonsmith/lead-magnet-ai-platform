import { db } from '@utils/db';
import { env } from '@utils/env';
import { JobProcessingUtils } from '@domains/workflows/services/workflow/workflowJobProcessingService';
import { logger } from '@utils/logger';
import { ApiError } from '@utils/errors';
import { ulid } from 'ulid';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export class TestJobService {
  private WORKFLOWS_TABLE = env.workflowsTable;
  private SUBMISSIONS_TABLE = env.submissionsTable;
  private JOBS_TABLE = env.jobsTable;

  async createAndRunTestJob(
    tenantId: string,
    workflowData: any,
    submissionInput: any,
    stepIndex: number | undefined,
    context?: any
  ): Promise<{ jobId: string; status: string; message: string; handled?: boolean }> {
    const testId = ulid();
    const workflowId = `test-workflow-${testId}`;
    const submissionId = `test-submission-${testId}`;
    const jobId = `test-job-${testId}`;

    logger.info('[Test Job] Starting test', {
      tenantId,
      jobId,
      stepIndex
    });

    try {
      // 1. Create temporary workflow
      const workflow = {
        workflow_id: workflowId,
        tenant_id: tenantId,
        workflow_name: workflowData.workflow_name || 'Test Workflow',
        workflow_description: workflowData.workflow_description || 'Temporary test workflow',
        steps: workflowData.steps,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_test: true // Marker for cleanup
      };
      await db.put(this.WORKFLOWS_TABLE, workflow);

      // 2. Create temporary submission
      const submission = {
        submission_id: submissionId,
        tenant_id: tenantId,
        form_id: 'test-form', // Dummy
        submission_data: submissionInput || {}, // User provided input
        created_at: new Date().toISOString()
      };
      await db.put(this.SUBMISSIONS_TABLE, submission);

      // 3. Create job
      const job = {
        job_id: jobId,
        tenant_id: tenantId,
        workflow_id: workflowId,
        submission_id: submissionId,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_test: true
      };
      await db.put(this.JOBS_TABLE, job);

      // 4. Trigger worker
      if (env.isDevelopment()) {
        const res = context?.res;
        if (res) {
            // Streaming mode
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            });
            
            res.write(`data: ${JSON.stringify({ type: 'init', job_id: jobId })}\n\n`);

            await this.triggerLocalWorker(jobId, stepIndex !== undefined ? String(stepIndex) : undefined, (log) => {
                res.write(`data: ${JSON.stringify({ type: 'log', content: log })}\n\n`);
            });
            
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            res.end();
            return { jobId, status: 'completed', message: 'Test completed', handled: true };
        } else {
            // Non-streaming (fire and forget)
            this.triggerLocalWorker(jobId, stepIndex !== undefined ? String(stepIndex) : undefined);
        }
      } else {
        await JobProcessingUtils.triggerAsyncProcessing(
            jobId,
            tenantId,
            {
            job_id: jobId,
            step_index: 0, // Always start at 0 for now, logic handles step skipping if needed? Or does it?
            // Actually for single step test, we might want to tell worker to only run that step?
            // But the current implementation just passes step_index: 0.
            // If stepIndex is provided, it's a single step test.
            // But JobProcessingUtils.triggerAsyncProcessing doesn't seem to take target step index to run ONLY that step.
            // It takes starting step index.
            // For now, mirroring existing logic: always start at 0.
            step_type: 'workflow_step'
            }
        );
      }

      return {
        jobId,
        status: 'pending',
        message: 'Test started'
      };

    } catch (error: any) {
      logger.error('[Test Job] Failed to start test', {
        error: error.message,
        stack: error.stack
      });
      throw new ApiError(`Failed to start test job: ${error.message}`, 500);
    }
  }

  /**
   * Helper to trigger local worker process
   */
  private async triggerLocalWorker(jobId: string, stepIndex?: string, onLog?: (log: string) => void): Promise<number> {
    
    // Determine worker path - assume running from backend/api
    // Try multiple paths to be safe
    let workerScript = path.resolve(process.cwd(), '../worker/worker.py');
    if (!fs.existsSync(workerScript)) {
       // Try relative to this file? No, too hard with TS build.
       // Try project root assumption
       workerScript = path.resolve(process.cwd(), 'backend/worker/worker.py');
    }
    
    if (!fs.existsSync(workerScript)) {
        logger.error('[Local Worker] Could not find worker script', { searchPath: workerScript });
        return 1;
    }

    const envVars = {
      ...process.env,
      JOB_ID: jobId,
      ...(stepIndex ? { STEP_INDEX: stepIndex } : {}),
      PYTHONUNBUFFERED: '1',
      LOG_FORMAT: 'json' // Force JSON logging for structured parsing in Playground
    };

    logger.info('[Local Worker] Spawning local worker', { script: workerScript, jobId, stepIndex });
    
    // Mark job as processing for better UX while the local worker runs.
    try {
      await db.update(this.JOBS_TABLE, { job_id: jobId }, { status: 'processing', updated_at: new Date().toISOString() });
    } catch (e: any) {
      logger.warn('[Local Worker] Failed to mark job as processing', { jobId, error: e?.message || String(e) });
    }

    return new Promise((resolve) => {
        const worker = spawn('python3', [workerScript], { env: envVars });

        let stderrTail = '';
        
        worker.stdout.on('data', (data: Buffer) => {
          const str = data.toString();
          logger.info(`[Worker Output] ${str}`);
          if (onLog) onLog(str);
        });
        
        worker.stderr.on('data', (data: Buffer) => {
          const str = data.toString();
          try {
            stderrTail = (stderrTail + str).slice(-2000);
          } catch {
            // ignore
          }
          logger.error(`[Worker Error] ${str}`);
          if (onLog) onLog(str);
        });
        
        worker.on('close', (code: number) => {
          logger.info('[Local Worker] Worker finished', { code });

          // Update job status based on local worker completion
          void (async () => {
            const now = new Date().toISOString();
            try {
              if (code === 0) {
                await db.update(this.JOBS_TABLE, { job_id: jobId }, { status: 'completed', updated_at: now, completed_at: now });
              } else {
                await db.update(this.JOBS_TABLE, { job_id: jobId }, {
                  status: 'failed',
                  updated_at: now,
                  completed_at: now,
                  error_message: stderrTail ? stderrTail.slice(-1000) : 'Local worker exited non-zero',
                  error_type: 'LocalWorkerError',
                });
              }
            } catch (e: any) {
              logger.error('[Local Worker] Failed to update test job status after worker finished', { jobId, code, error: e?.message || String(e) });
            }
          })();
          
          resolve(code);
        });
    });
  }
}

export const testJobService = new TestJobService();
