"use strict";
/**
 * OpenAI Client Service
 * Singleton service for managing OpenAI client instances with cached API key retrieval
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOpenAIClient = getOpenAIClient;
exports.clearOpenAIClientCache = clearOpenAIClientCache;
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const openai_1 = __importDefault(require("openai"));
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const env_1 = require("../utils/env");
const OPENAI_SECRET_NAME = env_1.env.openaiSecretName;
const secretsClient = new client_secrets_manager_1.SecretsManagerClient({ region: env_1.env.awsRegion });
// Cache the OpenAI client instance
let cachedClient = null;
let cachedApiKey = null;
/**
 * Get OpenAI client instance (singleton pattern with caching)
 * Retrieves API key from AWS Secrets Manager and caches both key and client
 */
async function getOpenAIClient() {
    // Return cached client if available
    if (cachedClient && cachedApiKey) {
        return cachedClient;
    }
    try {
        const command = new client_secrets_manager_1.GetSecretValueCommand({ SecretId: OPENAI_SECRET_NAME });
        const response = await secretsClient.send(command);
        if (!response.SecretString) {
            throw new errors_1.ApiError('OpenAI API key not found in secret', 500);
        }
        let apiKey;
        // Try to parse as JSON first (if secret is stored as {"OPENAI_API_KEY": "..."} or {"apiKey": "..."})
        try {
            const parsed = JSON.parse(response.SecretString);
            apiKey = parsed.OPENAI_API_KEY || parsed.apiKey || parsed.api_key || parsed.openai_api_key || response.SecretString;
        }
        catch {
            // If not JSON, use the secret string directly
            apiKey = response.SecretString;
        }
        if (!apiKey || apiKey.trim().length === 0) {
            throw new errors_1.ApiError('OpenAI API key is empty', 500);
        }
        // Cache the API key and create client
        cachedApiKey = apiKey;
        cachedClient = new openai_1.default({ apiKey });
        logger_1.logger.info('[OpenAI Service] Client initialized and cached');
        return cachedClient;
    }
    catch (error) {
        logger_1.logger.error('[OpenAI Service] Error getting OpenAI client', {
            error: error.message,
            secretName: OPENAI_SECRET_NAME
        });
        if (error instanceof errors_1.ApiError) {
            throw error;
        }
        throw new errors_1.ApiError(`Failed to initialize OpenAI client: ${error.message}`, 500);
    }
}
/**
 * Clear cached OpenAI client (useful for testing or key rotation)
 */
function clearOpenAIClientCache() {
    cachedClient = null;
    cachedApiKey = null;
    logger_1.logger.info('[OpenAI Service] Cache cleared');
}
//# sourceMappingURL=openaiService.js.map