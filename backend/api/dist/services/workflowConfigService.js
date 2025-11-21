"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowConfigService = void 0;
const costService_1 = require("./costService");
const workflowPromptBuilder_1 = require("../utils/workflowPromptBuilder");
const workflowConfigParser_1 = require("../utils/workflowConfigParser");
const logger_1 = require("../utils/logger");
/**
 * Service for generating workflow configuration.
 * Handles AI-powered workflow step generation.
 */
class WorkflowConfigService {
    constructor(openai, storeUsageRecord) {
        this.openai = openai;
        this.storeUsageRecord = storeUsageRecord;
    }
    /**
     * Generate workflow configuration from description
     */
    async generateWorkflowConfig(description, model, tenantId, jobId, brandContext, icpContext) {
        const workflowPrompt = (0, workflowPromptBuilder_1.buildWorkflowPrompt)({
            description,
            brandContext,
            icpContext,
        });
        logger_1.logger.info('[Workflow Config Service] Calling OpenAI for workflow generation...');
        const workflowStartTime = Date.now();
        const workflowCompletionParams = {
            model,
            instructions: 'You are an expert at creating AI-powered lead magnets. Return only valid JSON without markdown formatting.',
            input: workflowPrompt,
        };
        if (model !== 'gpt-5') {
            workflowCompletionParams.temperature = 0.7;
        }
        const workflowCompletion = await this.openai.responses.create(workflowCompletionParams);
        const workflowDuration = Date.now() - workflowStartTime;
        const workflowUsedModel = workflowCompletion.model || model;
        logger_1.logger.info('[Workflow Config Service] Workflow generation completed', {
            duration: `${workflowDuration}ms`,
            tokensUsed: workflowCompletion.usage?.total_tokens,
            modelUsed: workflowUsedModel,
        });
        // Track usage
        const workflowUsage = workflowCompletion.usage;
        let usageInfo = {
            service_type: 'openai_workflow_generate',
            model: workflowUsedModel,
            input_tokens: 0,
            output_tokens: 0,
            cost_usd: 0,
        };
        if (workflowUsage) {
            const inputTokens = workflowUsage.input_tokens || 0;
            const outputTokens = workflowUsage.output_tokens || 0;
            const costData = (0, costService_1.calculateOpenAICost)(workflowUsedModel, inputTokens, outputTokens);
            usageInfo = {
                service_type: 'openai_workflow_generate',
                model: workflowUsedModel,
                input_tokens: inputTokens,
                output_tokens: outputTokens,
                cost_usd: costData.cost_usd,
            };
            await this.storeUsageRecord(tenantId, 'openai_workflow_generate', workflowUsedModel, inputTokens, outputTokens, costData.cost_usd, jobId);
        }
        // Validate response has output_text
        if (!workflowCompletion.output_text) {
            throw new Error('OpenAI Responses API returned empty response. output_text is missing.');
        }
        const workflowContent = workflowCompletion.output_text;
        const workflowData = (0, workflowConfigParser_1.parseWorkflowConfig)(workflowContent, description);
        return { workflowData, usageInfo };
    }
}
exports.WorkflowConfigService = WorkflowConfigService;
//# sourceMappingURL=workflowConfigService.js.map