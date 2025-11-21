"use strict";
/**
 * Webhook Signature Verification
 * Verifies OpenAI webhook signatures using HMAC SHA-256
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyOpenAIWebhookSignature = verifyOpenAIWebhookSignature;
exports.extractSignatureFromHeaders = extractSignatureFromHeaders;
const crypto_1 = require("crypto");
const logger_1 = require("./logger");
/**
 * Verify OpenAI webhook signature
 * OpenAI uses Svix-style webhook signatures (HMAC SHA-256)
 *
 * @param payload - Raw request body as string
 * @param signature - Signature from 'svix-signature' header
 * @param secret - Webhook signing secret (starts with 'whsec_')
 * @returns true if signature is valid
 */
function verifyOpenAIWebhookSignature(payload, signature, secret) {
    if (!signature || !secret) {
        logger_1.logger.warn('[Webhook Signature] Missing signature or secret');
        return false;
    }
    // Remove 'whsec_' prefix if present
    const secretKey = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    try {
        // Parse the signature header (format: "v1,timestamp,signature")
        const parts = signature.split(',');
        if (parts.length !== 3) {
            logger_1.logger.warn('[Webhook Signature] Invalid signature format', { signature });
            return false;
        }
        const [version, timestamp, signatureHash] = parts;
        if (version !== 'v1') {
            logger_1.logger.warn('[Webhook Signature] Unsupported signature version', { version });
            return false;
        }
        // Create the signed payload: timestamp.payload
        const signedPayload = `${timestamp}.${payload}`;
        // Compute HMAC SHA-256
        const hmac = (0, crypto_1.createHmac)('sha256', secretKey);
        hmac.update(signedPayload);
        const computedSignature = hmac.digest('base64');
        // Compare signatures (constant-time comparison)
        const isValid = computedSignature === signatureHash;
        if (!isValid) {
            logger_1.logger.warn('[Webhook Signature] Signature verification failed', {
                computedLength: computedSignature.length,
                receivedLength: signatureHash.length,
            });
        }
        return isValid;
    }
    catch (error) {
        logger_1.logger.error('[Webhook Signature] Error verifying signature', {
            error: error.message,
        });
        return false;
    }
}
/**
 * Extract signature from request headers
 * OpenAI sends signature in 'svix-signature' header
 */
function extractSignatureFromHeaders(headers) {
    // Check various possible header names (case-insensitive)
    const headerNames = [
        'svix-signature',
        'svix-signature',
        'x-svix-signature',
        'openai-signature',
        'x-openai-signature',
    ];
    for (const headerName of headerNames) {
        // Check exact match first
        if (headers[headerName]) {
            return headers[headerName];
        }
        // Check case-insensitive
        const lowerHeaderName = headerName.toLowerCase();
        for (const [key, value] of Object.entries(headers)) {
            if (key.toLowerCase() === lowerHeaderName && value) {
                return value;
            }
        }
    }
    return null;
}
//# sourceMappingURL=webhookSignature.js.map