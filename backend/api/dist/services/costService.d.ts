/**
 * Cost calculation service for OpenAI API usage.
 * References: /Users/canyonsmith/market-research-report-v10/src/services/cost_service.py
 */
/**
 * Calculate OpenAI API cost for a request.
 *
 * @param model - Model name (e.g., "gpt-4o", "gpt-4-turbo")
 * @param inputTokens - Input token count
 * @param outputTokens - Output token count
 * @returns Object with input_tokens, output_tokens, and cost_usd
 */
export declare function calculateOpenAICost(model: string, inputTokens: number, outputTokens: number): {
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
};
/**
 * Get pricing for a model (for display purposes).
 */
export declare function getModelPricing(model: string): {
    input_per_1k_tokens_usd: number;
    output_per_1k_tokens_usd: number;
};
//# sourceMappingURL=costService.d.ts.map