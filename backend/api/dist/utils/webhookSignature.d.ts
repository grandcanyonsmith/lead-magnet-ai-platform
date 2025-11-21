/**
 * Webhook Signature Verification
 * Verifies OpenAI webhook signatures using HMAC SHA-256
 */
/**
 * Verify OpenAI webhook signature
 * OpenAI uses Svix-style webhook signatures (HMAC SHA-256)
 *
 * @param payload - Raw request body as string
 * @param signature - Signature from 'svix-signature' header
 * @param secret - Webhook signing secret (starts with 'whsec_')
 * @returns true if signature is valid
 */
export declare function verifyOpenAIWebhookSignature(payload: string, signature: string, secret: string): boolean;
/**
 * Extract signature from request headers
 * OpenAI sends signature in 'svix-signature' header
 */
export declare function extractSignatureFromHeaders(headers: Record<string, string | undefined>): string | null;
//# sourceMappingURL=webhookSignature.d.ts.map