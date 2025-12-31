/**
 * Billing Configuration
 * 
 * Defines how AI models are mapped to Stripe pricing meters.
 * This configuration centralizes the logic for mapping diverse model names/versions
 * to a standardized set of metered price keys.
 */

export interface ModelPriceMapping {
  // Regex pattern to match the model name (case-insensitive)
  pattern: RegExp;
  // The normalized price key to use (must match a key in env.stripeMeteredPriceMap)
  priceKey: string;
  // Priority (higher numbers matched first), helpful if patterns overlap
  priority: number;
}

export const MODEL_PRICE_MAPPINGS: ModelPriceMapping[] = [
  // Force all GPT-5* usage onto the gpt-5.2 meter (platform-wide standard)
  { pattern: /^gpt-5\.2/, priceKey: 'gpt-5.2', priority: 100 },
  { pattern: /^gpt-5/, priceKey: 'gpt-5.2', priority: 90 },
  
  // GPT-4 variants
  { pattern: /^gpt-4\.1/, priceKey: 'gpt-4.1', priority: 90 },
  { pattern: /^gpt-4o-mini/, priceKey: 'gpt-4o-mini', priority: 90 },
  { pattern: /^gpt-4o/, priceKey: 'gpt-4o', priority: 80 }, // Lower priority than mini
  { pattern: /^gpt-4-turbo/, priceKey: 'gpt-4-turbo', priority: 90 },
  
  // Legacy
  { pattern: /^gpt-3\.5-turbo/, priceKey: 'gpt-3.5-turbo', priority: 90 },
  
  // Anthropic / Computer Use
  { pattern: /^computer-use-preview/, priceKey: 'computer-use-preview', priority: 90 },
  
  // Research models (o4/o3)
  // Map both o4-mini-deep and o3-deep to the same o4-mini-deep-research price
  { pattern: /o4-mini-deep/, priceKey: 'o4-mini-deep-research', priority: 90 },
  { pattern: /o3-deep/, priceKey: 'o4-mini-deep-research', priority: 90 },
];

/**
 * Resolves a raw model name to a normalized price key using the mappings.
 * Returns the original name if no mapping matches.
 */
export function resolveModelPriceKey(rawModel: string): string {
  const normalized = rawModel.toLowerCase().trim();
  
  // Sort by priority descending
  const sortedMappings = [...MODEL_PRICE_MAPPINGS].sort((a, b) => b.priority - a.priority);
  
  for (const mapping of sortedMappings) {
    if (mapping.pattern.test(normalized)) {
      return mapping.priceKey;
    }
  }
  
  return normalized;
}

