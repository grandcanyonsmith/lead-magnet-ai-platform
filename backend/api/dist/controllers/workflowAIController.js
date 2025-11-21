"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.workflowAIController = exports.WorkflowAIController = void 0;
const ulid_1 = require("ulid");
const db_1 = require("../utils/db");
const errors_1 = require("../utils/errors");
const workflowGenerationService_1 = require("../services/workflowGenerationService");
const workflowStepAIService_1 = require("../services/workflowStepAIService");
const workflowAIService_1 = require("../services/workflowAIService");
const workflowInstructionsService_1 = require("../services/workflowInstructionsService");
const jobProcessingUtils_1 = require("../utils/jobProcessingUtils");
const logger_1 = require("../utils/logger");
const openaiService_1 = require("../services/openaiService");
const usageTrackingService_1 = require("../services/usageTrackingService");
const env_1 = require("../utils/env");
const icpFetcher_1 = require("../utils/icpFetcher");
const webhookService_1 = require("../services/webhookService");
const draftWorkflowService_1 = require("../services/draftWorkflowService");
const JOBS_TABLE = env_1.env.jobsTable;
const USER_SETTINGS_TABLE = env_1.env.userSettingsTable;
/**
 * Controller for AI-powered workflow operations.
 * Handles workflow generation, refinement, and AI editing.
 */
class WorkflowAIController {
    /**
     * Validate webhook URL format.
     */
    _validateWebhookUrl(webhook_url) {
        if (!webhook_url) {
            return;
        }
        if (typeof webhook_url !== 'string' || !webhook_url.trim()) {
            throw new errors_1.ApiError('webhook_url must be a valid URL string', 400);
        }
        // Basic URL validation
        try {
            new URL(webhook_url);
        }
        catch {
            throw new errors_1.ApiError('webhook_url must be a valid URL', 400);
        }
    }
    /**
     * Create workflow generation job record.
     */
    async _createWorkflowGenerationJob(tenantId, description, model, webhook_url) {
        const jobId = `wfgen_${(0, ulid_1.ulid)()}`;
        const job = {
            job_id: jobId,
            tenant_id: tenantId,
            job_type: 'workflow_generation',
            status: 'pending',
            description,
            model,
            result: null,
            error_message: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        // Store webhook_url if provided, replacing {jobId} placeholder with actual jobId
        if (webhook_url) {
            job.webhook_url = webhook_url.replace('{jobId}', jobId);
        }
        await db_1.db.put(JOBS_TABLE, job);
        logger_1.logger.info('[Workflow Generation] Created job record', { jobId });
        return jobId;
    }
    /**
     * Trigger async job processing (Lambda or local).
     */
    async _triggerJobProcessing(jobId, tenantId, description, model) {
        // Check if we're in local development - process synchronously
        if (env_1.env.isDevelopment()) {
            logger_1.logger.info('[Workflow Generation] Local mode detected, processing synchronously', { jobId });
            // Process the job synchronously in local dev (fire and forget, but with error handling)
            setImmediate(async () => {
                try {
                    await this.processWorkflowGenerationJob(jobId, tenantId, description, model);
                }
                catch (error) {
                    logger_1.logger.error('[Workflow Generation] Error processing job in local mode', {
                        jobId,
                        error: error.message,
                        errorStack: error.stack,
                    });
                    // Update job status to failed
                    await db_1.db.update(JOBS_TABLE, { job_id: jobId }, {
                        status: 'failed',
                        error_message: `Processing failed: ${error.message}`,
                        updated_at: new Date().toISOString(),
                    });
                }
            });
        }
        else {
            await jobProcessingUtils_1.JobProcessingUtils.triggerAsyncProcessing(jobId, tenantId, {
                source: 'workflow-generation-job',
                description,
                model,
            }, async (jobId, tenantId, ...args) => {
                const payload = args[0];
                await this.processWorkflowGenerationJob(jobId, tenantId, payload.description || '', payload.model || 'gpt-4');
            });
        }
    }
    /**
     * Generate a workflow with AI (async).
     * Creates a job and triggers async processing.
     */
    async generateWithAI(tenantId, body) {
        const { description, model = 'gpt-5', webhook_url } = body;
        if (!description || !description.trim()) {
            throw new errors_1.ApiError('Description is required', 400);
        }
        // Validate webhook_url if provided
        this._validateWebhookUrl(webhook_url);
        logger_1.logger.info('[Workflow Generation] Starting async generation', {
            tenantId,
            model,
            descriptionLength: description.length,
            hasWebhookUrl: !!webhook_url,
            timestamp: new Date().toISOString(),
        });
        // Create workflow generation job record
        const jobId = await this._createWorkflowGenerationJob(tenantId, description, model, webhook_url);
        // Invoke Lambda asynchronously to process workflow generation
        try {
            await this._triggerJobProcessing(jobId, tenantId, description, model);
        }
        catch (error) {
            logger_1.logger.error('[Workflow Generation] Failed to trigger async processing', {
                error: error.message,
                errorStack: error.stack,
                jobId,
                isLocal: env_1.env.isDevelopment(),
            });
            throw new errors_1.ApiError(`Failed to start workflow generation: ${error.message}`, 500);
        }
        // Return immediately with job_id
        return {
            statusCode: 202, // Accepted
            body: {
                job_id: jobId,
                status: 'pending',
                message: 'Workflow generation started. Poll /admin/workflows/generation-status/:jobId for status.',
            },
        };
    }
    /**
     * Initialize generation service and start timing.
     */
    async _initializeGeneration() {
        const openai = await (0, openaiService_1.getOpenAIClient)();
        const generationService = new workflowGenerationService_1.WorkflowGenerationService(openai, async (tenantId, serviceType, model, inputTokens, outputTokens, costUsd, jobId) => {
            await usageTrackingService_1.usageTrackingService.storeUsageRecord({
                tenantId,
                serviceType,
                model,
                inputTokens,
                outputTokens,
                costUsd,
                jobId,
            });
        });
        const startTime = Date.now();
        logger_1.logger.info('[Workflow Generation] OpenAI client initialized');
        return { generationService, startTime };
    }
    /**
     * Fetch brand context and ICP content.
     */
    async _fetchBrandAndICPContext(tenantId) {
        // Fetch settings to get brand context and ICP URL
        const settings = await db_1.db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId });
        const brandContext = settings ? (0, icpFetcher_1.buildBrandContext)(settings) : '';
        // Fetch ICP document content if URL is provided
        let icpContext = null;
        if (settings?.icp_document_url) {
            logger_1.logger.info('[Workflow Generation] Fetching ICP document', { url: settings.icp_document_url });
            icpContext = await (0, icpFetcher_1.fetchICPContent)(settings.icp_document_url);
            if (icpContext) {
                logger_1.logger.info('[Workflow Generation] ICP document fetched successfully', { contentLength: icpContext.length });
            }
            else {
                logger_1.logger.warn('[Workflow Generation] Failed to fetch ICP document, continuing without it');
            }
        }
        return { brandContext, icpContext };
    }
    /**
     * Generate all workflow components in parallel.
     */
    async _generateWorkflowComponents(generationService, jobDescription, jobModel, tenantId, jobId, brandContext, icpContext) {
        // Generate workflow config first (needed for form generation)
        const workflowResult = await generationService.generateWorkflowConfig(jobDescription, jobModel, tenantId, jobId, brandContext || undefined, icpContext || undefined);
        // Generate template HTML, metadata, and form fields in parallel
        const [templateHtmlResult, templateMetadataResult, formFieldsResult] = await Promise.all([
            generationService.generateTemplateHTML(jobDescription, jobModel, tenantId, jobId, brandContext || undefined, icpContext || undefined),
            generationService.generateTemplateMetadata(jobDescription, jobModel, tenantId, jobId, brandContext || undefined, icpContext || undefined),
            generationService.generateFormFields(jobDescription, workflowResult.workflowData.workflow_name, jobModel, tenantId, jobId, brandContext || undefined, icpContext || undefined),
        ]);
        return {
            workflowResult,
            templateHtmlResult,
            templateMetadataResult,
            formFieldsResult,
        };
    }
    /**
     * Save workflow result and update job status.
     */
    async _saveWorkflowResult(generationService, workflowResult, templateMetadataResult, templateHtmlResult, formFieldsResult, tenantId, jobId, startTime) {
        const totalDuration = Date.now() - startTime;
        logger_1.logger.info('[Workflow Generation] Success!', {
            tenantId,
            workflowName: workflowResult.workflowData.workflow_name,
            templateName: templateMetadataResult.templateName,
            htmlLength: templateHtmlResult.htmlContent.length,
            formFieldsCount: formFieldsResult.formData.fields.length,
            totalDuration: `${totalDuration}ms`,
            timestamp: new Date().toISOString(),
        });
        // Process results into final format
        const result = generationService.processGenerationResult(workflowResult.workflowData, templateMetadataResult.templateName, templateMetadataResult.templateDescription, templateHtmlResult.htmlContent, formFieldsResult.formData);
        // Save workflow as draft
        logger_1.logger.info('[Workflow Generation] Saving workflow as draft', { jobId });
        const { workflow_id, form_id } = await (0, draftWorkflowService_1.saveDraftWorkflow)(tenantId, {
            workflow_name: result.workflow.workflow_name,
            workflow_description: result.workflow.workflow_description,
            steps: result.workflow.steps || [],
            form_fields_schema: result.form.form_fields_schema,
        }, result.template.html_content, result.template.template_name, result.template.template_description);
        logger_1.logger.info('[Workflow Generation] Draft workflow saved', {
            jobId,
            workflowId: workflow_id,
            formId: form_id,
        });
        // Update job with result and workflow_id
        await db_1.db.update(JOBS_TABLE, { job_id: jobId }, {
            status: 'completed',
            result: result,
            workflow_id: workflow_id,
            updated_at: new Date().toISOString(),
        });
        logger_1.logger.info('[Workflow Generation] Job completed successfully', { jobId, workflowId: workflow_id });
        return { workflow_id, form_id, result };
    }
    /**
     * Send webhook notification.
     */
    async _sendWebhookNotification(webhook_url, payload, jobId) {
        try {
            await (0, webhookService_1.sendWorkflowGenerationWebhook)(webhook_url, payload);
        }
        catch (webhookError) {
            // Log webhook error but don't fail the job
            logger_1.logger.error('[Workflow Generation] Failed to send webhook', {
                jobId,
                webhookUrl: webhook_url,
                error: webhookError.message,
            });
        }
    }
    /**
     * Handle job error and send failure webhook if needed.
     */
    async _handleJobError(error, jobId, job) {
        logger_1.logger.error('[Workflow Generation] Job failed', {
            jobId,
            error: error.message,
        });
        const errorMessage = error.message || 'Unknown error';
        await db_1.db.update(JOBS_TABLE, { job_id: jobId }, {
            status: 'failed',
            error_message: errorMessage,
            updated_at: new Date().toISOString(),
        });
        // Send webhook notification for failure if webhook_url was provided
        if (job.webhook_url) {
            await this._sendWebhookNotification(job.webhook_url, {
                job_id: jobId,
                status: 'failed',
                error_message: errorMessage,
                failed_at: new Date().toISOString(),
            }, jobId);
        }
    }
    /**
     * Process a workflow generation job.
     * Called asynchronously to generate the workflow.
     */
    async processWorkflowGenerationJob(jobId, tenantId, description, model) {
        logger_1.logger.info('[Workflow Generation] Processing job', { jobId, tenantId });
        // Load job to get webhook_url and description if not provided
        const job = await db_1.db.get(JOBS_TABLE, { job_id: jobId });
        if (!job) {
            throw new Error(`Job ${jobId} not found`);
        }
        // Use job description if not provided as parameter
        const jobDescription = description || job.description || '';
        const jobModel = model || job.model || 'gpt-5';
        try {
            // Update job status to processing
            await db_1.db.update(JOBS_TABLE, { job_id: jobId }, {
                status: 'processing',
                updated_at: new Date().toISOString(),
            });
            // Initialize generation
            const { generationService, startTime } = await this._initializeGeneration();
            // Fetch context
            const { brandContext, icpContext } = await this._fetchBrandAndICPContext(tenantId);
            // Generate all components
            const { workflowResult, templateHtmlResult, templateMetadataResult, formFieldsResult, } = await this._generateWorkflowComponents(generationService, jobDescription, jobModel, tenantId, jobId, brandContext, icpContext);
            // Save results
            const { workflow_id, result } = await this._saveWorkflowResult(generationService, workflowResult, templateMetadataResult, templateHtmlResult, formFieldsResult, tenantId, jobId, startTime);
            // Send webhook notification if webhook_url was provided
            if (job.webhook_url) {
                await this._sendWebhookNotification(job.webhook_url, {
                    job_id: jobId,
                    status: 'completed',
                    workflow_id: workflow_id,
                    workflow: result,
                    completed_at: new Date().toISOString(),
                }, jobId);
            }
        }
        catch (error) {
            await this._handleJobError(error, jobId, job);
            throw error;
        }
    }
    /**
     * Get the status of a workflow generation job.
     */
    async getGenerationStatus(tenantId, jobId) {
        const job = await db_1.db.get(JOBS_TABLE, { job_id: jobId });
        if (!job) {
            throw new errors_1.ApiError('Job not found', 404);
        }
        if (job.tenant_id !== tenantId) {
            throw new errors_1.ApiError('Unauthorized', 403);
        }
        // If job has been pending for more than 30 seconds and we're in local/dev mode, try to process it
        if (job.status === 'pending' && env_1.env.isDevelopment()) {
            const createdAt = new Date(job.created_at).getTime();
            const now = Date.now();
            const ageSeconds = (now - createdAt) / 1000;
            // Only try once per job (check if there's a processing_attempted flag or just try if old enough)
            if (ageSeconds > 30 && !job.processing_attempted) {
                logger_1.logger.info('[Workflow Generation] Job stuck in pending, attempting to process', {
                    jobId,
                    ageSeconds,
                });
                // Mark as attempted to prevent multiple retries
                await db_1.db.update(JOBS_TABLE, { job_id: jobId }, {
                    processing_attempted: true,
                    updated_at: new Date().toISOString(),
                });
                // Try to process the job
                const description = job.description || '';
                const model = job.model || 'gpt-5';
                setImmediate(async () => {
                    try {
                        await this.processWorkflowGenerationJob(jobId, tenantId, description, model);
                    }
                    catch (error) {
                        logger_1.logger.error('[Workflow Generation] Error processing stuck job', {
                            jobId,
                            error: error.message,
                            errorStack: error.stack,
                        });
                    }
                });
            }
        }
        return {
            statusCode: 200,
            body: {
                job_id: jobId,
                status: job.status,
                result: job.result,
                error_message: job.error_message,
                workflow_id: job.workflow_id, // Include workflow_id if available
                created_at: job.created_at,
                updated_at: job.updated_at,
            },
        };
    }
    /**
     * Refine workflow instructions using AI.
     */
    async refineInstructions(tenantId, body) {
        const refinedInstructions = await workflowInstructionsService_1.workflowInstructionsService.refineInstructions({
            current_instructions: body.current_instructions,
            edit_prompt: body.edit_prompt,
            model: body.model,
            tenantId,
        });
        return {
            statusCode: 200,
            body: {
                refined_instructions: refinedInstructions,
            },
        };
    }
    /**
     * Generate a workflow step using AI.
     */
    async aiGenerateStep(tenantId, workflowId, body) {
        const { db } = await Promise.resolve().then(() => __importStar(require('../utils/db')));
        const { env } = await Promise.resolve().then(() => __importStar(require('../utils/env')));
        const WORKFLOWS_TABLE = env.workflowsTable;
        // Validate required fields
        if (!body.userPrompt || typeof body.userPrompt !== 'string') {
            throw new errors_1.ApiError('userPrompt is required and must be a string', 400);
        }
        // Get the workflow
        const workflow = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });
        if (!workflow || workflow.deleted_at) {
            throw new errors_1.ApiError('This lead magnet doesn\'t exist or has been removed', 404);
        }
        if (workflow.tenant_id !== tenantId) {
            throw new errors_1.ApiError('You don\'t have permission to access this lead magnet', 403);
        }
        logger_1.logger.info('[AI Step Generation] Starting generation', {
            workflowId,
            workflowName: workflow.workflow_name,
            userPrompt: body.userPrompt.substring(0, 100),
            action: body.action,
            currentStepIndex: body.currentStepIndex,
        });
        try {
            // Get OpenAI client
            const openai = await (0, openaiService_1.getOpenAIClient)();
            const aiService = new workflowStepAIService_1.WorkflowStepAIService(openai);
            // Prepare the request
            const aiRequest = {
                userPrompt: body.userPrompt,
                action: body.action,
                workflowContext: {
                    workflow_id: workflowId,
                    workflow_name: workflow.workflow_name || 'Untitled Workflow',
                    workflow_description: workflow.workflow_description || '',
                    current_steps: (workflow.steps || []).map((step) => ({
                        step_name: step.step_name,
                        step_description: step.step_description,
                        model: step.model,
                        tools: step.tools,
                    })),
                },
                currentStep: body.currentStep,
                currentStepIndex: body.currentStepIndex,
            };
            // Generate the step
            const result = await aiService.generateStep(aiRequest);
            logger_1.logger.info('[AI Step Generation] Generation successful', {
                workflowId,
                action: result.action,
                stepName: result.step.step_name,
            });
            return {
                statusCode: 200,
                body: result,
            };
        }
        catch (error) {
            logger_1.logger.error('[AI Step Generation] Error', {
                workflowId,
                error: error.message,
                stack: error.stack,
            });
            throw new errors_1.ApiError(`Failed to generate step: ${error.message}`, 500);
        }
    }
    /**
     * Edit a workflow using AI.
     */
    async aiEditWorkflow(tenantId, workflowId, body) {
        const { db } = await Promise.resolve().then(() => __importStar(require('../utils/db')));
        const { env } = await Promise.resolve().then(() => __importStar(require('../utils/env')));
        const WORKFLOWS_TABLE = env.workflowsTable;
        // Validate required fields
        if (!body.userPrompt || typeof body.userPrompt !== 'string') {
            throw new errors_1.ApiError('userPrompt is required and must be a string', 400);
        }
        // Get the workflow
        const workflow = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });
        if (!workflow || workflow.deleted_at) {
            throw new errors_1.ApiError('This lead magnet doesn\'t exist or has been removed', 404);
        }
        if (workflow.tenant_id !== tenantId) {
            throw new errors_1.ApiError('You don\'t have permission to access this lead magnet', 403);
        }
        logger_1.logger.info('[AI Workflow Edit] Starting edit', {
            workflowId,
            workflowName: workflow.workflow_name,
            userPrompt: body.userPrompt.substring(0, 100),
            currentStepCount: workflow.steps?.length || 0,
        });
        try {
            // Get OpenAI client
            const openai = await (0, openaiService_1.getOpenAIClient)();
            const aiService = new workflowAIService_1.WorkflowAIService(openai);
            // Prepare the request
            const aiRequest = {
                userPrompt: body.userPrompt,
                workflowContext: {
                    workflow_id: workflowId,
                    workflow_name: workflow.workflow_name || 'Untitled Workflow',
                    workflow_description: workflow.workflow_description || '',
                    template_id: workflow.template_id,
                    current_steps: workflow.steps || [],
                },
            };
            // Edit the workflow
            const result = await aiService.editWorkflow(aiRequest);
            logger_1.logger.info('[AI Workflow Edit] Edit successful', {
                workflowId,
                newStepCount: result.steps.length,
                changesSummary: result.changes_summary,
            });
            return {
                statusCode: 200,
                body: result,
            };
        }
        catch (error) {
            logger_1.logger.error('[AI Workflow Edit] Error', {
                workflowId,
                error: error.message,
                stack: error.stack,
            });
            throw new errors_1.ApiError(`Failed to edit workflow: ${error.message}`, 500);
        }
    }
}
exports.WorkflowAIController = WorkflowAIController;
exports.workflowAIController = new WorkflowAIController();
//# sourceMappingURL=workflowAIController.js.map