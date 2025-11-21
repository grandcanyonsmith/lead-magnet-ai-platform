/**
 * Webhook token generation utilities.
 *
 * Provides secure token generation for webhook authentication.
 *
 * @module webhookToken
 */
/**
 * Generate a secure webhook token using cryptographically secure random bytes.
 *
 * Returns a URL-safe base64 encoded string suitable for use in URLs and headers.
 * The token is cryptographically secure and suitable for authentication purposes.
 *
 * @param length - Optional byte length (default: 32, recommended: 32-64)
 * @returns URL-safe base64 encoded token string
 * @throws {ValidationError} If length is invalid
 *
 * @example
 * ```typescript
 * const token = generateWebhookToken();
 * // Returns: "aBc123-XyZ456_..." (43 characters)
 *
 * const longToken = generateWebhookToken(64);
 * // Returns longer token for higher security
 * ```
 */
export declare function generateWebhookToken(length?: number): string;
/**
 * Validate a webhook token format.
 *
 * Checks that the token is a non-empty string with valid characters.
 * Does not validate cryptographic strength, only format.
 *
 * @param token - Token to validate
 * @returns True if token format is valid
 *
 * @example
 * ```typescript
 * if (isValidWebhookToken(token)) {
 *   // Token format is valid
 * }
 * ```
 */
export declare function isValidWebhookToken(token: unknown): token is string;
//# sourceMappingURL=webhookToken.d.ts.map