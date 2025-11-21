"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.templateAIService = exports.TemplateAIService = void 0;
const openaiService_1 = require("./openaiService");
const costService_1 = require("./costService");
const usageTrackingService_1 = require("./usageTrackingService");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
/**
 * Service for generating and refining templates using AI.
 */
class TemplateAIService {
    /**
     * Generate a template with AI.
     */
    async generateWithAI(request) {
        const { description, model = 'gpt-5', tenantId } = request;
        if (!description || !description.trim()) {
            throw new errors_1.ApiError('Description is required', 400);
        }
        logger_1.logger.info('[Template Generation] Starting AI generation', {
            tenantId,
            model,
            descriptionLength: description.length,
            timestamp: new Date().toISOString(),
        });
        try {
            const openai = await (0, openaiService_1.getOpenAIClient)();
            logger_1.logger.info('[Template Generation] OpenAI client initialized');
            const prompt = `You are an expert HTML template designer for lead magnets. Create a professional HTML template based on this description: "${description}"

Requirements:
1. Generate a complete, valid HTML5 document
2. Include modern, clean CSS styling (inline or in <style> tag)
3. DO NOT use placeholder syntax - use actual sample content and descriptive text
4. Make it responsive and mobile-friendly
5. Use professional color scheme and typography
6. Design it to beautifully display lead magnet content
7. Include actual text content that demonstrates the design - use sample headings, paragraphs, and sections
8. The HTML should be ready to use with real content filled in manually or via code

Return ONLY the HTML code, no markdown formatting, no explanations.`;
            logger_1.logger.info('[Template Generation] Calling OpenAI for HTML generation...', {
                model,
                promptLength: prompt.length,
            });
            const htmlStartTime = Date.now();
            const completionParams = {
                model,
                instructions: 'You are an expert HTML template designer. Return only valid HTML code without markdown formatting.',
                input: prompt,
            };
            // GPT-5 only supports default temperature (1), don't set custom temperature
            if (model !== 'gpt-5') {
                // Note: temperature not set for gpt-5, but this is fine
            }
            const completion = await openai.responses.create(completionParams);
            const htmlDuration = Date.now() - htmlStartTime;
            const htmlModelUsed = completion.model || model;
            logger_1.logger.info('[Template Generation] HTML generation completed', {
                duration: `${htmlDuration}ms`,
                tokensUsed: completion.usage?.total_tokens,
                model: htmlModelUsed,
            });
            // Track usage
            const usage = completion.usage;
            if (usage) {
                const inputTokens = usage.input_tokens || 0;
                const outputTokens = usage.output_tokens || 0;
                const costData = (0, costService_1.calculateOpenAICost)(htmlModelUsed, inputTokens, outputTokens);
                await usageTrackingService_1.usageTrackingService.storeUsageRecord({
                    tenantId,
                    serviceType: 'openai_template_generate',
                    model: htmlModelUsed,
                    inputTokens,
                    outputTokens,
                    costUsd: costData.cost_usd,
                });
            }
            // Validate response has output_text
            if (!completion.output_text) {
                throw new errors_1.ApiError('OpenAI Responses API returned empty response. output_text is missing for template HTML generation.', 500);
            }
            const htmlContent = completion.output_text;
            logger_1.logger.info('[Template Generation] Raw HTML received', {
                htmlLength: htmlContent.length,
                firstChars: htmlContent.substring(0, 100),
            });
            // Clean up markdown code blocks if present
            const cleanedHtml = this.cleanMarkdownCodeBlocks(htmlContent);
            // Extract placeholder tags (disabled - no longer using placeholder syntax)
            const placeholderTags = [];
            logger_1.logger.info('[Template Generation] Extracted placeholders', {
                placeholderCount: placeholderTags.length,
                placeholders: placeholderTags,
            });
            // Generate template name and description
            const { templateName, templateDescription } = await this.generateTemplateMetadata(description, model, tenantId);
            const totalDuration = Date.now() - htmlStartTime;
            logger_1.logger.info('[Template Generation] Success!', {
                tenantId,
                templateName,
                htmlLength: cleanedHtml.length,
                placeholderCount: placeholderTags.length,
                totalDuration: `${totalDuration}ms`,
                timestamp: new Date().toISOString(),
            });
            return {
                template_name: templateName,
                template_description: templateDescription,
                html_content: cleanedHtml,
                placeholder_tags: placeholderTags,
            };
        }
        catch (error) {
            logger_1.logger.error('[Template Generation] Error occurred', {
                tenantId,
                errorMessage: error.message,
                errorName: error.name,
                errorStack: error.stack,
                timestamp: new Date().toISOString(),
            });
            throw new errors_1.ApiError(error.message || 'Failed to generate template with AI', 500);
        }
    }
    /**
     * Refine a template with AI.
     */
    async refineWithAI(request) {
        const { current_html, edit_prompt, model = 'gpt-5', tenantId } = request;
        if (!current_html || !current_html.trim()) {
            throw new errors_1.ApiError('Current HTML content is required', 400);
        }
        if (!edit_prompt || !edit_prompt.trim()) {
            throw new errors_1.ApiError('Edit prompt is required', 400);
        }
        logger_1.logger.info('[Template Refinement] Starting refinement', {
            tenantId,
            model,
            currentHtmlLength: current_html.length,
            editPromptLength: edit_prompt.length,
            timestamp: new Date().toISOString(),
        });
        try {
            const openai = await (0, openaiService_1.getOpenAIClient)();
            logger_1.logger.info('[Template Refinement] OpenAI client initialized');
            // Check if user wants to remove placeholders
            const shouldRemovePlaceholders = edit_prompt.toLowerCase().includes('remove placeholder') ||
                edit_prompt.toLowerCase().includes('no placeholder') ||
                edit_prompt.toLowerCase().includes('dont use placeholder') ||
                edit_prompt.toLowerCase().includes('don\'t use placeholder');
            const prompt = `You are an expert HTML template designer. Modify the following HTML template based on these instructions: "${edit_prompt}"

Current HTML:
${current_html}

Requirements:
${shouldRemovePlaceholders
                ? '1. REMOVE all placeholder syntax {{PLACEHOLDER_NAME}} and replace with actual content or remove the elements containing them'
                : '1. Keep all placeholder syntax {{PLACEHOLDER_NAME}} exactly as they are'}
2. Apply the requested changes while maintaining the overall structure
3. Ensure the HTML remains valid and well-formed
4. Keep modern, clean CSS styling
5. Maintain responsiveness and mobile-friendliness
${shouldRemovePlaceholders
                ? '6. Use real values instead of placeholders - replace {{TITLE}} with actual text, {{COLORS}} with real color values (e.g., #2d8659 for green), etc.'
                : ''}

Return ONLY the modified HTML code, no markdown formatting, no explanations.`;
            logger_1.logger.info('[Template Refinement] Calling OpenAI for refinement...', {
                model,
                promptLength: prompt.length,
            });
            const refineStartTime = Date.now();
            const completionParams = {
                model,
                instructions: shouldRemovePlaceholders
                    ? 'You are an expert HTML template designer. Return only valid HTML code without markdown formatting. REMOVE all placeholder syntax {{PLACEHOLDER_NAME}} and replace with actual content or real values (e.g., replace {{BRAND_COLORS}} with actual color codes like #2d8659).'
                    : 'You are an expert HTML template designer. Return only valid HTML code without markdown formatting. Preserve all placeholder syntax {{PLACEHOLDER_NAME}} exactly.',
                input: prompt,
            };
            // GPT-5 only supports default temperature (1), don't set custom temperature
            if (model !== 'gpt-5') {
                completionParams.temperature = 0.7;
            }
            const completion = await openai.responses.create(completionParams);
            const refineDuration = Date.now() - refineStartTime;
            const refinementModelUsed = completion.model || model;
            logger_1.logger.info('[Template Refinement] Refinement completed', {
                duration: `${refineDuration}ms`,
                tokensUsed: completion.usage?.total_tokens,
                model: refinementModelUsed,
            });
            // Track usage
            const usage = completion.usage;
            if (usage) {
                const inputTokens = usage.input_tokens || 0;
                const outputTokens = usage.output_tokens || 0;
                const costData = (0, costService_1.calculateOpenAICost)(refinementModelUsed, inputTokens, outputTokens);
                await usageTrackingService_1.usageTrackingService.storeUsageRecord({
                    tenantId,
                    serviceType: 'openai_template_refine',
                    model: refinementModelUsed,
                    inputTokens,
                    outputTokens,
                    costUsd: costData.cost_usd,
                });
            }
            // Validate response has output_text
            if (!completion.output_text) {
                throw new errors_1.ApiError('OpenAI Responses API returned empty response. output_text is missing for template refinement.', 500);
            }
            const htmlContent = completion.output_text;
            logger_1.logger.info('[Template Refinement] Refined HTML received', {
                htmlLength: htmlContent.length,
                firstChars: htmlContent.substring(0, 100),
            });
            // Clean up markdown code blocks if present
            const cleanedHtml = this.cleanMarkdownCodeBlocks(htmlContent);
            // Extract placeholder tags (disabled - no longer using placeholder syntax)
            const placeholderTags = [];
            logger_1.logger.info('[Template Refinement] Extracted placeholders', {
                placeholderCount: placeholderTags.length,
                placeholders: placeholderTags,
            });
            const totalDuration = Date.now() - refineStartTime;
            logger_1.logger.info('[Template Refinement] Success!', {
                tenantId,
                htmlLength: cleanedHtml.length,
                placeholderCount: placeholderTags.length,
                totalDuration: `${totalDuration}ms`,
                timestamp: new Date().toISOString(),
            });
            return {
                html_content: cleanedHtml,
                placeholder_tags: placeholderTags,
            };
        }
        catch (error) {
            logger_1.logger.error('[Template Refinement] Error occurred', {
                tenantId,
                errorMessage: error.message,
                errorName: error.name,
                errorStack: error.stack,
                timestamp: new Date().toISOString(),
            });
            throw new errors_1.ApiError(error.message || 'Failed to refine template with AI', 500);
        }
    }
    /**
     * Generate template name and description.
     */
    async generateTemplateMetadata(description, model, tenantId) {
        const namePrompt = `Based on this template description: "${description}", generate:
1. A short, descriptive template name (2-4 words max)
2. A brief template description (1-2 sentences)

Return JSON format: {"name": "...", "description": "..."}`;
        logger_1.logger.info('[Template Generation] Calling OpenAI for name/description generation...');
        const nameStartTime = Date.now();
        const openai = await (0, openaiService_1.getOpenAIClient)();
        const nameCompletionParams = {
            model,
            input: namePrompt,
        };
        // GPT-5 only supports default temperature (1), don't set custom temperature
        if (model !== 'gpt-5') {
            nameCompletionParams.temperature = 0.5;
        }
        const nameCompletion = await openai.responses.create(nameCompletionParams);
        const nameDuration = Date.now() - nameStartTime;
        const namingModelUsed = nameCompletion.model || model;
        logger_1.logger.info('[Template Generation] Name/description generation completed', {
            duration: `${nameDuration}ms`,
            tokensUsed: nameCompletion.usage?.total_tokens,
            modelUsed: namingModelUsed,
        });
        // Track usage for name/description generation
        const nameUsage = nameCompletion.usage;
        if (nameUsage) {
            const inputTokens = nameUsage.input_tokens || 0;
            const outputTokens = nameUsage.output_tokens || 0;
            const costData = (0, costService_1.calculateOpenAICost)(namingModelUsed, inputTokens, outputTokens);
            await usageTrackingService_1.usageTrackingService.storeUsageRecord({
                tenantId,
                serviceType: 'openai_template_generate',
                model: namingModelUsed,
                inputTokens,
                outputTokens,
                costUsd: costData.cost_usd,
            });
        }
        // Validate response has output_text
        if (!nameCompletion.output_text) {
            throw new errors_1.ApiError('OpenAI Responses API returned empty response. output_text is missing for template name generation.', 500);
        }
        const nameContent = nameCompletion.output_text;
        let templateName = 'Generated Template';
        let templateDescription = description;
        try {
            // Try to parse JSON response
            const jsonMatch = nameContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                templateName = parsed.name || templateName;
                templateDescription = parsed.description || templateDescription;
                logger_1.logger.info('[Template Generation] Parsed name/description from JSON', {
                    templateName,
                    templateDescriptionLength: templateDescription.length,
                });
            }
        }
        catch (e) {
            // If JSON parsing fails, use defaults
            templateName = description.split(' ').slice(0, 3).join(' ') + ' Template';
            logger_1.logger.info('[Template Generation] JSON parsing failed, using fallback', {
                error: e instanceof Error ? e.message : String(e),
                fallbackName: templateName,
            });
        }
        return { templateName, templateDescription };
    }
    /**
     * Clean markdown code blocks from HTML content.
     */
    cleanMarkdownCodeBlocks(content) {
        let cleaned = content.trim();
        if (cleaned.startsWith('```html')) {
            cleaned = cleaned.replace(/^```html\s*/i, '').replace(/\s*```$/i, '');
            logger_1.logger.info('[Template AI] Removed ```html markers');
        }
        else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
            logger_1.logger.info('[Template AI] Removed ``` markers');
        }
        return cleaned;
    }
}
exports.TemplateAIService = TemplateAIService;
exports.templateAIService = new TemplateAIService();
//# sourceMappingURL=templateAIService.js.map