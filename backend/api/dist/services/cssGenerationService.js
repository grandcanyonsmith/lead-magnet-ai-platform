"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cssGenerationService = exports.CSSGenerationService = void 0;
const openaiService_1 = require("./openaiService");
const costService_1 = require("./costService");
const usageTrackingService_1 = require("./usageTrackingService");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
/**
 * Service for generating and refining CSS using AI.
 */
class CSSGenerationService {
    /**
     * Generate CSS for a form based on a description.
     */
    async generateCSS(request) {
        const { form_fields_schema, css_prompt, model = 'gpt-5', tenantId } = request;
        if (!form_fields_schema || !form_fields_schema.fields || form_fields_schema.fields.length === 0) {
            throw new errors_1.ApiError('Form fields schema is required', 400);
        }
        if (!css_prompt || !css_prompt.trim()) {
            throw new errors_1.ApiError('CSS prompt is required', 400);
        }
        logger_1.logger.info('[Form CSS Generation] Starting CSS generation', {
            tenantId,
            model,
            fieldCount: form_fields_schema.fields.length,
            cssPromptLength: css_prompt.length,
            timestamp: new Date().toISOString(),
        });
        try {
            const openai = await (0, openaiService_1.getOpenAIClient)();
            logger_1.logger.info('[Form CSS Generation] OpenAI client initialized');
            const fieldsDescription = form_fields_schema.fields.map((f) => `- ${f.field_type}: ${f.label} (${f.required ? 'required' : 'optional'})`).join('\n');
            const prompt = `You are an expert CSS designer. Generate CSS styles for a form based on this description: "${css_prompt}"

Form Fields:
${fieldsDescription}

Requirements:
1. Generate valid CSS only (no HTML, no markdown formatting)
2. Style the form container, fields, labels, inputs, textareas, selects, and buttons
3. Use modern, clean design principles
4. Make it responsive and mobile-friendly
5. Apply the requested styling from the description

Return ONLY the CSS code, no markdown formatting, no explanations.`;
            logger_1.logger.info('[Form CSS Generation] Calling OpenAI for CSS generation', {
                model,
                promptLength: prompt.length,
            });
            const cssStartTime = Date.now();
            const completionParams = {
                model,
                instructions: 'You are an expert CSS designer. Return only valid CSS code without markdown formatting.',
                input: prompt,
            };
            // GPT-5 only supports default temperature (1), don't set custom temperature
            if (model !== 'gpt-5') {
                completionParams.temperature = 0.7;
            }
            const completion = await openai.responses.create(completionParams);
            const cssDuration = Date.now() - cssStartTime;
            const cssModelUsed = completion.model || model;
            logger_1.logger.info('[Form CSS Generation] CSS generation completed', {
                duration: `${cssDuration}ms`,
                tokensUsed: completion.usage?.total_tokens,
                model: cssModelUsed,
            });
            // Track usage
            const usage = completion.usage;
            if (usage) {
                const inputTokens = usage.input_tokens || 0;
                const outputTokens = usage.output_tokens || 0;
                const costData = (0, costService_1.calculateOpenAICost)(cssModelUsed, inputTokens, outputTokens);
                await usageTrackingService_1.usageTrackingService.storeUsageRecord({
                    tenantId,
                    serviceType: 'openai_form_css',
                    model: cssModelUsed,
                    inputTokens,
                    outputTokens,
                    costUsd: costData.cost_usd,
                });
            }
            // Validate response has output_text
            if (!completion.output_text) {
                throw new errors_1.ApiError('OpenAI Responses API returned empty response. output_text is missing for form CSS generation.', 500);
            }
            const cssContent = completion.output_text;
            logger_1.logger.info('[Form CSS Generation] Raw CSS received', {
                cssLength: cssContent.length,
                firstChars: cssContent.substring(0, 100),
            });
            // Clean up markdown code blocks if present
            const cleanedCss = this.cleanMarkdownCodeBlocks(cssContent);
            const totalDuration = Date.now() - cssStartTime;
            logger_1.logger.info('[Form CSS Generation] Success!', {
                tenantId,
                cssLength: cleanedCss.length,
                totalDuration: `${totalDuration}ms`,
                timestamp: new Date().toISOString(),
            });
            return cleanedCss;
        }
        catch (error) {
            logger_1.logger.error('[Form CSS Generation] Error occurred', {
                tenantId,
                errorMessage: error.message,
                errorName: error.name,
                errorStack: error.stack,
                timestamp: new Date().toISOString(),
            });
            throw new errors_1.ApiError(error.message || 'Failed to generate CSS with AI', 500);
        }
    }
    /**
     * Refine existing CSS based on a prompt.
     */
    async refineCSS(request) {
        const { current_css, css_prompt, model = 'gpt-5', tenantId } = request;
        if (!current_css || !current_css.trim()) {
            throw new errors_1.ApiError('Current CSS is required', 400);
        }
        if (!css_prompt || !css_prompt.trim()) {
            throw new errors_1.ApiError('CSS prompt is required', 400);
        }
        logger_1.logger.info('[Form CSS Refinement] Starting refinement', {
            tenantId,
            model,
            currentCssLength: current_css.length,
            cssPromptLength: css_prompt.length,
            timestamp: new Date().toISOString(),
        });
        try {
            const openai = await (0, openaiService_1.getOpenAIClient)();
            logger_1.logger.info('[Form CSS Refinement] OpenAI client initialized');
            const prompt = `You are an expert CSS designer. Modify the following CSS based on these instructions: "${css_prompt}"

Current CSS:
${current_css}

Requirements:
1. Apply the requested changes while maintaining valid CSS syntax
2. Keep the overall structure unless specifically asked to change it
3. Ensure the CSS remains well-organized and readable
4. Return only the modified CSS code, no markdown formatting, no explanations

Return ONLY the modified CSS code, no markdown formatting, no explanations.`;
            logger_1.logger.info('[Form CSS Refinement] Calling OpenAI for refinement', {
                model,
                promptLength: prompt.length,
            });
            const refineStartTime = Date.now();
            const completionParams = {
                model,
                instructions: 'You are an expert CSS designer. Return only valid CSS code without markdown formatting.',
                input: prompt,
            };
            // GPT-5 only supports default temperature (1), don't set custom temperature
            if (model !== 'gpt-5') {
                completionParams.temperature = 0.7;
            }
            const completion = await openai.responses.create(completionParams);
            const refineDuration = Date.now() - refineStartTime;
            const refineCssModel = completion.model || model;
            logger_1.logger.info('[Form CSS Refinement] Refinement completed', {
                duration: `${refineDuration}ms`,
                tokensUsed: completion.usage?.total_tokens,
                model: refineCssModel,
            });
            // Track usage
            const usage = completion.usage;
            if (usage) {
                const inputTokens = usage.input_tokens || 0;
                const outputTokens = usage.output_tokens || 0;
                const costData = (0, costService_1.calculateOpenAICost)(refineCssModel, inputTokens, outputTokens);
                await usageTrackingService_1.usageTrackingService.storeUsageRecord({
                    tenantId,
                    serviceType: 'openai_form_css_refine',
                    model: refineCssModel,
                    inputTokens,
                    outputTokens,
                    costUsd: costData.cost_usd,
                });
            }
            // Validate response has output_text
            if (!completion.output_text) {
                throw new errors_1.ApiError('OpenAI Responses API returned empty response. output_text is missing for form CSS refinement.', 500);
            }
            const cssContent = completion.output_text;
            logger_1.logger.info('[Form CSS Refinement] Refined CSS received', {
                cssLength: cssContent.length,
                firstChars: cssContent.substring(0, 100),
            });
            // Clean up markdown code blocks if present
            const cleanedCss = this.cleanMarkdownCodeBlocks(cssContent);
            const totalDuration = Date.now() - refineStartTime;
            logger_1.logger.info('[Form CSS Refinement] Success!', {
                tenantId,
                cssLength: cleanedCss.length,
                totalDuration: `${totalDuration}ms`,
                timestamp: new Date().toISOString(),
            });
            return cleanedCss;
        }
        catch (error) {
            logger_1.logger.error('[Form CSS Refinement] Error occurred', {
                tenantId,
                errorMessage: error.message,
                errorName: error.name,
                errorStack: error.stack,
                timestamp: new Date().toISOString(),
            });
            throw new errors_1.ApiError(error.message || 'Failed to refine CSS with AI', 500);
        }
    }
    /**
     * Clean markdown code blocks from CSS content.
     */
    cleanMarkdownCodeBlocks(content) {
        let cleaned = content.trim();
        if (cleaned.startsWith('```css')) {
            cleaned = cleaned.replace(/^```css\s*/i, '').replace(/\s*```$/i, '');
            logger_1.logger.info('[CSS Generation] Removed ```css markers');
        }
        else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
            logger_1.logger.info('[CSS Generation] Removed ``` markers');
        }
        return cleaned;
    }
}
exports.CSSGenerationService = CSSGenerationService;
exports.cssGenerationService = new CSSGenerationService();
//# sourceMappingURL=cssGenerationService.js.map