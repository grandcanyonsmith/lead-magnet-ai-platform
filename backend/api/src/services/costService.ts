/**
 * Cost calculation service for OpenAI API usage.
 * References: /Users/canyonsmith/market-research-report-v10/src/services/cost_service.py
 */

// OpenAI model pricing (per 1K tokens, USD)
// Source: OpenAI pricing as of 2024
const OPENAI_PRICING: Record<
  string,
  { input_per_1k_tokens_usd: number; output_per_1k_tokens_usd: number }
> = {
  "gpt-4o": {
    input_per_1k_tokens_usd: 0.0025, // $2.50 per 1M tokens
    output_per_1k_tokens_usd: 0.01, // $10 per 1M tokens
  },
  "gpt-4.1": {
    input_per_1k_tokens_usd: 0.0025, // $2.50 per 1M tokens
    output_per_1k_tokens_usd: 0.01, // $10 per 1M tokens
  },
  "gpt-4-turbo": {
    input_per_1k_tokens_usd: 0.01, // $10 per 1M tokens
    output_per_1k_tokens_usd: 0.03, // $30 per 1M tokens
  },
  "gpt-3.5-turbo": {
    input_per_1k_tokens_usd: 0.0005, // $0.50 per 1M tokens
    output_per_1k_tokens_usd: 0.0015, // $1.50 per 1M tokens
  },
  "gpt-4o-mini": {
    input_per_1k_tokens_usd: 0.00015, // $0.15 per 1M tokens
    output_per_1k_tokens_usd: 0.0006, // $0.60 per 1M tokens
  },
  "gpt-5": {
    input_per_1k_tokens_usd: 0.005,
    output_per_1k_tokens_usd: 0.015,
  },
  // Treat GPT-5.1 as same pricing tier as GPT-5 unless/until updated pricing is provided
  "gpt-5.1": {
    input_per_1k_tokens_usd: 0.005,
    output_per_1k_tokens_usd: 0.015,
  },
  // Treat GPT-5.2 as same pricing tier as GPT-5 unless/until updated pricing is provided
  "gpt-5.2": {
    input_per_1k_tokens_usd: 0.005,
    output_per_1k_tokens_usd: 0.015,
  },
  "computer-use-preview": {
    input_per_1k_tokens_usd: 0.005, // $5 per 1M tokens (similar to gpt-5)
    output_per_1k_tokens_usd: 0.015, // $15 per 1M tokens (similar to gpt-5)
  },
};

/**
 * Calculate OpenAI API cost for a request.
 *
 * @param model - Model name (e.g., "gpt-4o", "gpt-4-turbo")
 * @param inputTokens - Input token count
 * @param outputTokens - Output token count
 * @returns Object with input_tokens, output_tokens, and cost_usd
 */
export function calculateOpenAICost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): { input_tokens: number; output_tokens: number; cost_usd: number } {
  const pricing = OPENAI_PRICING[model] || OPENAI_PRICING["gpt-4o"]; // Default to gpt-4o if unknown

  // Calculate cost with precision
  // Use number arithmetic but round to avoid floating point errors
  const inputCost = (inputTokens / 1000) * pricing.input_per_1k_tokens_usd;
  const outputCost = (outputTokens / 1000) * pricing.output_per_1k_tokens_usd;
  const totalCost = inputCost + outputCost;

  // Round to 6 decimal places for precision (same as reference implementation)
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: Math.round(totalCost * 1000000) / 1000000,
  };
}

/**
 * Get pricing for a model (for display purposes).
 */
export function getModelPricing(model: string): {
  input_per_1k_tokens_usd: number;
  output_per_1k_tokens_usd: number;
} {
  return OPENAI_PRICING[model] || OPENAI_PRICING["gpt-4o"];
}
