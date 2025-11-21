/**
 * OpenAI Client Service
 * Singleton service for managing OpenAI client instances with cached API key retrieval
 */
import OpenAI from 'openai';
/**
 * Get OpenAI client instance (singleton pattern with caching)
 * Retrieves API key from AWS Secrets Manager and caches both key and client
 */
export declare function getOpenAIClient(): Promise<OpenAI>;
/**
 * Clear cached OpenAI client (useful for testing or key rotation)
 */
export declare function clearOpenAIClientCache(): void;
//# sourceMappingURL=openaiService.d.ts.map