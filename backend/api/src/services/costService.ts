/**
 * Cost calculation service for OpenAI API usage.
 * References: /Users/canyonsmith/market-research-report-v10/src/services/cost_service.py
 */

// OpenAI model pricing (per 1K tokens, USD)
// Keep in sync with https://openai.com/api/pricing/
const OPENAI_PRICING: Record<
  string,
  { input_per_1k_tokens_usd: number; output_per_1k_tokens_usd: number }
> = {
  "gpt-4o": {
    input_per_1k_tokens_usd: 0.0025,
    output_per_1k_tokens_usd: 0.01,
  },
  "gpt-4o-mini": {
    input_per_1k_tokens_usd: 0.00015,
    output_per_1k_tokens_usd: 0.0006,
  },
  "gpt-4.1": {
    input_per_1k_tokens_usd: 0.002,
    output_per_1k_tokens_usd: 0.008,
  },
  "gpt-4.1-mini": {
    input_per_1k_tokens_usd: 0.0004,
    output_per_1k_tokens_usd: 0.0016,
  },
  "gpt-5": {
    input_per_1k_tokens_usd: 0.005,
    output_per_1k_tokens_usd: 0.015,
  },
  "gpt-5.1": {
    input_per_1k_tokens_usd: 0.005,
    output_per_1k_tokens_usd: 0.015,
  },
  "gpt-5.2": {
    input_per_1k_tokens_usd: 0.005,
    output_per_1k_tokens_usd: 0.015,
  },
  "o3": {
    input_per_1k_tokens_usd: 0.01,
    output_per_1k_tokens_usd: 0.04,
  },
  "o4-mini": {
    input_per_1k_tokens_usd: 0.0011,
    output_per_1k_tokens_usd: 0.0044,
  },
  "o4-mini-deep-research": {
    input_per_1k_tokens_usd: 0.0011,
    output_per_1k_tokens_usd: 0.0044,
  },
  "computer-use-preview": {
    input_per_1k_tokens_usd: 0.005,
    output_per_1k_tokens_usd: 0.015,
  },
  "gpt-image-1.5": {
    input_per_1k_tokens_usd: 0.005,
    output_per_1k_tokens_usd: 0.04,
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
  const pricing = OPENAI_PRICING[model] || OPENAI_PRICING["gpt-5.2"]; // Default to gpt-5.2 if unknown

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
  return OPENAI_PRICING[model] || OPENAI_PRICING["gpt-5.2"];
}
