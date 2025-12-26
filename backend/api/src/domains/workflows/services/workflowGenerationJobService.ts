import { ulid } from 'ulid';
import { db } from '@utils/db';
import { logger } from '@utils/logger';
import { JobProcessingUtils } from './workflow/workflowJobProcessingService';
import { env } from '@utils/env';
import { getOpenAIClient } from '@services/openaiService';
import { WorkflowGenerationService } from './workflowGenerationService';
import { usageTrackingService } from '@services/usageTrackingService';
import { fetchICPContent, buildBrandContext } from './workflow/workflowContextService';
import { sendWorkflowGenerationWebhook } from '@services/webhookService';
import { saveDraftWorkflow } from './draftWorkflowService';

const JOBS_TABLE = env.jobsTable;
const USER_SETTINGS_TABLE = env.userSettingsTable;

type StartWorkflowGenerationInput = {
  tenantId: string;
  description: string;
  model: string;
  webhookUrl?: string;
};

class WorkflowGenerationJobService {
  async startWorkflowGeneration({
    tenantId,
    description,
    model,
    webhookUrl,
  }: StartWorkflowGenerationInput): Promise<{ jobId: string }> {
    const jobId = `wfgen_${ulid()}`;
    const now = new Date().toISOString();

    const jobRecord: Record<string, any> = {
      job_id: jobId,
      tenant_id: tenantId,
      job_type: 'workflow_generation',
      status: 'pending',
      description,
      model,
      result: null,
      error_message: null,
      created_at: now,
      updated_at: now,
    };

    if (webhookUrl) {
      jobRecord.webhook_url = webhookUrl.replace('{jobId}', jobId);
    }

    await db.put(JOBS_TABLE, jobRecord);
    logger.info('[Workflow Generation] Created job record', { jobId, tenantId });

    await JobProcessingUtils.triggerAsyncProcessing(
      jobId,
      tenantId,
      {
        source: 'workflow-generation-job',
        description,
        model,
      },
      async (localJobId: string, localTenantId: string) => {
        await this.processWorkflowGenerationJob(localJobId, localTenantId, description, model);
      }
    );

    return { jobId };
  }

  async getJob(jobId: string): Promise<Record<string, any> | null> {
    const job = await db.get(JOBS_TABLE, { job_id: jobId });
    return job ?? null;
  }

  async ensureLocalProcessing(job: Record<string, any>): Promise<void> {
    if (!job || job.status !== 'pending' || !env.isDevelopment()) {
      return;
    }

    const createdAt = new Date(job.created_at).getTime();
    const ageSeconds = (Date.now() - createdAt) / 1000;

    if (Number.isNaN(ageSeconds) || ageSeconds <= 30 || job.processing_attempted) {
      return;
    }

    logger.info('[Workflow Generation] Job stuck in pending, attempting to process', {
      jobId: job.job_id,
      ageSeconds,
    });

    await db.update(JOBS_TABLE, { job_id: job.job_id }, {
      processing_attempted: true,
      updated_at: new Date().toISOString(),
    });

    const description = job.description || '';
    const model = job.model || 'gpt-5.2';

    setImmediate(async () => {
      try {
        await this.processWorkflowGenerationJob(job.job_id, job.tenant_id, description, model);
      } catch (error: any) {
        logger.error('[Workflow Generation] Error processing stuck job', {
          jobId: job.job_id,
          error: error.message,
          stack: error.stack,
        });
      }
    });
  }

  async processWorkflowGenerationJob(jobId: string, tenantId: string, description: string, model: string): Promise<void> {
    logger.info('[Workflow Generation] Processing job', { jobId, tenantId });

    const job = await db.get(JOBS_TABLE, { job_id: jobId });
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const jobDescription = description || job.description || '';
    const jobModel = model || job.model || 'gpt-5.2';

    try {
      await db.update(JOBS_TABLE, { job_id: jobId }, {
        status: 'processing',
        updated_at: new Date().toISOString(),
      });

      const openai = await getOpenAIClient();
      const generationService = new WorkflowGenerationService(
        openai,
        async (usageTenantId, serviceType, usageModel, inputTokens, outputTokens, costUsd, usageJobId) => {
          await usageTrackingService.storeUsageRecord({
            tenantId: usageTenantId,
            serviceType,
            model: usageModel,
            inputTokens,
            outputTokens,
            costUsd,
            jobId: usageJobId,
          });
        }
      );

      const workflowStartTime = Date.now();
      logger.info('[Workflow Generation] OpenAI client initialized');

      const settings = await db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId });
      const brandContext = settings ? buildBrandContext(settings) : '';

      let icpContext: string | null = null;
      if (settings?.icp_document_url) {
        logger.info('[Workflow Generation] Fetching ICP document', { url: settings.icp_document_url });
        icpContext = await fetchICPContent(settings.icp_document_url);
        if (icpContext) {
          logger.info('[Workflow Generation] ICP document fetched successfully', { contentLength: icpContext.length });
        } else {
          logger.warn('[Workflow Generation] Failed to fetch ICP document, continuing without it');
        }
      }

      const workflowResult = await generationService.generateWorkflowConfig(
        jobDescription,
        jobModel,
        tenantId,
        jobId,
        brandContext || undefined,
        icpContext || undefined
      );

      const [templateHtmlResult, templateMetadataResult, formFieldsResult] = await Promise.all([
        generationService.generateTemplateHTML(
          jobDescription,
          jobModel,
          tenantId,
          jobId,
          brandContext || undefined,
          icpContext || undefined
        ),
        generationService.generateTemplateMetadata(
          jobDescription,
          jobModel,
          tenantId,
          jobId,
          brandContext || undefined,
          icpContext || undefined
        ),
        generationService.generateFormFields(
          jobDescription,
          workflowResult.workflowData.workflow_name,
          jobModel,
          tenantId,
          jobId,
          brandContext || undefined,
          icpContext || undefined
        ),
      ]);

      const totalDuration = Date.now() - workflowStartTime;
      logger.info('[Workflow Generation] Success!', {
        tenantId,
        workflowName: workflowResult.workflowData.workflow_name,
        templateName: templateMetadataResult.templateName,
        htmlLength: templateHtmlResult.htmlContent.length,
        formFieldsCount: formFieldsResult.formData.fields.length,
        totalDuration: `${totalDuration}ms`,
        timestamp: new Date().toISOString(),
      });

      const result = generationService.processGenerationResult(
        workflowResult.workflowData,
        templateMetadataResult.templateName,
        templateMetadataResult.templateDescription,
        templateHtmlResult.htmlContent,
        formFieldsResult.formData
      );

      logger.info('[Workflow Generation] Saving workflow as active', { jobId });
      const { workflow_id, form_id } = await saveDraftWorkflow(
        tenantId,
        {
          workflow_name: result.workflow.workflow_name,
          workflow_description: result.workflow.workflow_description,
          steps: result.workflow.steps || [],
          form_fields_schema: result.form.form_fields_schema,
        },
        result.template.html_content,
        result.template.template_name,
        result.template.template_description
      );

      logger.info('[Workflow Generation] Workflow saved as active', {
        jobId,
        workflowId: workflow_id,
        formId: form_id,
      });

      await db.update(JOBS_TABLE, { job_id: jobId }, {
        status: 'completed',
        result,
        workflow_id,
        updated_at: new Date().toISOString(),
      });

      logger.info('[Workflow Generation] Job completed successfully', { jobId, workflowId: workflow_id });

      if (job.webhook_url) {
        try {
          await sendWorkflowGenerationWebhook(job.webhook_url, {
            job_id: jobId,
            status: 'completed',
            workflow_id,
            workflow: result,
            completed_at: new Date().toISOString(),
          });
        } catch (webhookError: any) {
          logger.error('[Workflow Generation] Failed to send completion webhook', {
            jobId,
            webhookUrl: job.webhook_url,
            error: webhookError.message,
          });
        }
      }
    } catch (error: any) {
      logger.error('[Workflow Generation] Job failed', {
        jobId,
        error: error.message,
      });

      const errorMessage = error.message || 'Unknown error';
      await db.update(JOBS_TABLE, { job_id: jobId }, {
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      });

      if (job.webhook_url) {
        try {
          await sendWorkflowGenerationWebhook(job.webhook_url, {
            job_id: jobId,
            status: 'failed',
            error_message: errorMessage,
            failed_at: new Date().toISOString(),
          });
        } catch (webhookError: any) {
          logger.error('[Workflow Generation] Failed to send failure webhook', {
            jobId,
            webhookUrl: job.webhook_url,
            error: webhookError.message,
          });
        }
      }

      throw error;
    }
  }
}

export const workflowGenerationJobService = new WorkflowGenerationJobService();
