"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workflowInstructionsService = exports.WorkflowInstructionsService = void 0;
const openaiService_1 = require("./openaiService");
const costService_1 = require("./costService");
const usageTrackingService_1 = require("./usageTrackingService");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
/**
 * Service for refining workflow instructions using AI.
 */
class WorkflowInstructionsService {
    /**
     * Refine workflow instructions using AI.
     */
    async refineInstructions(request) {
        const { current_instructions, edit_prompt, model = 'gpt-5', tenantId } = request;
        if (!current_instructions || !current_instructions.trim()) {
            throw new errors_1.ApiError('Current instructions are required', 400);
        }
        if (!edit_prompt || !edit_prompt.trim()) {
            throw new errors_1.ApiError('Edit prompt is required', 400);
        }
        logger_1.logger.info('[Workflow Instructions Refinement] Starting refinement', {
            tenantId,
            model,
            currentInstructionsLength: current_instructions.length,
            editPromptLength: edit_prompt.length,
            timestamp: new Date().toISOString(),
        });
        try {
            const openai = await (0, openaiService_1.getOpenAIClient)();
            logger_1.logger.info('[Workflow Instructions Refinement] OpenAI client initialized');
            const prompt = this.buildRefinementPrompt(current_instructions, edit_prompt);
            logger_1.logger.info('[Workflow Instructions Refinement] Calling OpenAI for refinement...', {
                model,
                promptLength: prompt.length,
            });
            const refineStartTime = Date.now();
            const completionParams = {
                model,
                instructions: 'You are an expert AI prompt engineer. Return only the modified instructions without markdown formatting.',
                input: prompt,
            };
            // GPT-5 only supports default temperature (1), don't set custom temperature
            if (model !== 'gpt-5') {
                completionParams.temperature = 0.7;
            }
            const completion = await openai.responses.create(completionParams);
            const refineDuration = Date.now() - refineStartTime;
            const refinementModel = completion.model || model;
            logger_1.logger.info('[Workflow Instructions Refinement] Refinement completed', {
                duration: `${refineDuration}ms`,
                tokensUsed: completion.usage?.total_tokens,
                model: refinementModel,
            });
            // Track usage
            const usage = completion.usage;
            if (usage) {
                const inputTokens = usage.input_tokens || 0;
                const outputTokens = usage.output_tokens || 0;
                const costData = (0, costService_1.calculateOpenAICost)(refinementModel, inputTokens, outputTokens);
                await usageTrackingService_1.usageTrackingService.storeUsageRecord({
                    tenantId,
                    serviceType: 'openai_workflow_refine',
                    model: refinementModel,
                    inputTokens,
                    outputTokens,
                    costUsd: costData.cost_usd,
                });
            }
            // Validate response has output_text
            if (!completion.output_text) {
                throw new errors_1.ApiError('OpenAI Responses API returned empty response. output_text is missing for workflow instructions refinement.', 500);
            }
            const refinedContent = completion.output_text;
            // Clean up markdown code blocks if present
            const cleanedContent = this.cleanMarkdownCodeBlocks(refinedContent);
            return cleanedContent;
        }
        catch (error) {
            logger_1.logger.error('[Workflow Instructions Refinement] Error occurred', {
                tenantId,
                errorMessage: error.message,
                errorName: error.name,
                errorStack: error.stack,
                timestamp: new Date().toISOString(),
            });
            throw new errors_1.ApiError(error.message || 'Failed to refine instructions', 500);
        }
    }
    /**
     * Build the refinement prompt with comprehensive guidance.
     */
    buildRefinementPrompt(current_instructions, edit_prompt) {
        return `You are an expert AI prompt engineer specializing in creating effective instructions for AI lead magnet generators. Modify the following research instructions based on these requests: "${edit_prompt}"

Current Instructions:
${current_instructions}

## Your Task

Apply the requested changes while maintaining and improving instruction quality. Follow these principles:

## Instruction Quality Standards

### ✅ Good Instruction Characteristics:
1. **Specificity**: Clear, concrete requirements (not vague like "make it good")
2. **Actionability**: Provides clear direction on what to do
3. **Field References**: Uses [field_name] syntax to reference form submission data
4. **Output Format**: Specifies expected structure, sections, or format
5. **Personalization**: Includes guidance on personalizing content from form data
6. **Context Awareness**: References previous steps when applicable
7. **Quality Standards**: Sets expectations for depth, detail, or comprehensiveness

### ❌ Common Pitfalls to Avoid:
1. **Vagueness**: "Generate a report" → Better: "Generate a comprehensive market research report for [company_name]..."
2. **No Field References**: Missing [field_name] syntax for personalization
3. **No Structure**: Not specifying output format or organization
4. **Too Generic**: Not tailored to the specific lead magnet type
5. **Missing Context**: Not referencing how to use previous step outputs
6. **Subjective Language**: Using terms like "good", "better", "nice" without specifics

## Examples of Effective Instructions

### Example 1 - Research Step:
**Good:**
"Generate a comprehensive market research report for [company_name] in the [industry] industry. Research current market trends, competitor landscape, and growth opportunities. Include specific statistics, recent developments, and actionable insights. Personalize all recommendations based on [company_name]'s size ([company_size]) and target market ([target_market]). Format as a structured markdown document with clear sections: Executive Summary, Market Overview, Competitive Analysis, and Recommendations."

**Bad:**
"Generate a report about the market."

### Example 2 - Analysis Step:
**Good:**
"Analyze the research findings from Step 1 and create a personalized SWOT analysis for [company_name]. Focus on opportunities and threats specific to the [industry] industry. Include actionable recommendations based on [company_name]'s current situation ([current_challenges]). Structure the output with four clear sections: Strengths, Weaknesses, Opportunities, and Threats, each with 3-5 specific points."

**Bad:**
"Analyze the research and create a SWOT analysis."

### Example 3 - Content Generation Step:
**Good:**
"Create a personalized action plan document for [name] at [company_name]. Use insights from previous steps to create 5-7 specific, actionable recommendations. Format as a clear, professional document with sections for each recommendation. Include timelines and expected outcomes where relevant. Personalize each recommendation based on [company_name]'s industry ([industry]) and goals ([goals])."

**Bad:**
"Create an action plan."

## Best Practices Checklist

When modifying instructions, ensure:

- [ ] Instructions are specific and actionable
- [ ] Form fields are referenced using [field_name] syntax
- [ ] Output format is clearly defined (structure, sections, format)
- [ ] Quality standards are set (depth, detail, comprehensiveness)
- [ ] Personalization guidance is included
- [ ] Previous step outputs are referenced when applicable
- [ ] Instructions avoid vague or subjective language
- [ ] Instructions are tailored to the specific lead magnet type

## Modification Guidelines

1. **Apply Requested Changes**: Implement the specific changes requested in "${edit_prompt}"
2. **Maintain Quality**: Ensure the modified instructions meet the quality standards above
3. **Preserve Structure**: Keep the overall structure and format unless specifically asked to change it
4. **Enhance Clarity**: If the changes create ambiguity, add clarifying details
5. **Preserve Field References**: Maintain all [field_name] syntax references
6. **Improve When Possible**: If you see opportunities to improve clarity or specificity while making requested changes, do so

## Common Improvement Patterns

- **Adding Specificity**: "Generate a report" → "Generate a comprehensive [type] report for [company_name]..."
- **Adding Structure**: "Create content" → "Create a structured document with sections: [list sections]..."
- **Adding Personalization**: "Analyze data" → "Analyze data for [company_name] in the [industry] industry..."
- **Adding Quality Standards**: "Research competitors" → "Research competitors and include specific statistics, recent developments, and actionable insights..."
- **Adding Format Guidance**: "Create recommendations" → "Create 5-7 recommendations formatted as a clear list with actionable steps..."

## Output Requirements

Return ONLY the modified instructions:
- No markdown formatting (no code blocks, no \`\`\`)
- No explanations or commentary
- Just the improved instructions text
- Maintain the same general structure unless changes require restructuring`;
    }
    /**
     * Clean markdown code blocks from content.
     */
    cleanMarkdownCodeBlocks(content) {
        let cleaned = content.trim();
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```\w*\s*/i, '').replace(/\s*```$/i, '');
        }
        return cleaned;
    }
}
exports.WorkflowInstructionsService = WorkflowInstructionsService;
exports.workflowInstructionsService = new WorkflowInstructionsService();
//# sourceMappingURL=workflowInstructionsService.js.map