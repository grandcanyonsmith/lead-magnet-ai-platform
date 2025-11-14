/**
 * OpenAI Client Service
 * Singleton service for managing OpenAI client instances with cached API key retrieval
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import OpenAI from 'openai';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';
import { env } from '../utils/env';

const OPENAI_SECRET_NAME = env.openaiSecretName;
const secretsClient = new SecretsManagerClient({ region: env.awsRegion });

// Cache the OpenAI client instance
let cachedClient: OpenAI | null = null;
let cachedApiKey: string | null = null;

/**
 * Get OpenAI client instance (singleton pattern with caching)
 * Retrieves API key from AWS Secrets Manager and caches both key and client
 */
export async function getOpenAIClient(): Promise<OpenAI> {
  // Return cached client if available
  if (cachedClient && cachedApiKey) {
    return cachedClient;
  }

  try {
    const command = new GetSecretValueCommand({ SecretId: OPENAI_SECRET_NAME });
    const response = await secretsClient.send(command);
    
    if (!response.SecretString) {
      throw new ApiError('OpenAI API key not found in secret', 500);
    }

    let apiKey: string;
    
    // Try to parse as JSON first (if secret is stored as {"OPENAI_API_KEY": "..."} or {"apiKey": "..."})
    try {
      const parsed = JSON.parse(response.SecretString);
      apiKey = parsed.OPENAI_API_KEY || parsed.apiKey || parsed.api_key || parsed.openai_api_key || response.SecretString;
    } catch {
      // If not JSON, use the secret string directly
      apiKey = response.SecretString;
    }
    
    if (!apiKey || apiKey.trim().length === 0) {
      throw new ApiError('OpenAI API key is empty', 500);
    }

    // Cache the API key and create client
    cachedApiKey = apiKey;
    cachedClient = new OpenAI({ apiKey });
    
    logger.info('[OpenAI Service] Client initialized and cached');
    
    return cachedClient;
  } catch (error: any) {
    logger.error('[OpenAI Service] Error getting OpenAI client', { 
      error: error.message,
      secretName: OPENAI_SECRET_NAME 
    });
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(`Failed to initialize OpenAI client: ${error.message}`, 500);
  }
}

/**
 * Clear cached OpenAI client (useful for testing or key rotation)
 */
export function clearOpenAIClientCache(): void {
  cachedClient = null;
  cachedApiKey = null;
  logger.info('[OpenAI Service] Cache cleared');
}

