/**
 * Webhook token generation utilities.
 *
 * Provides secure token generation for webhook authentication.
 *
 * @module webhookToken
 */

import { randomBytes } from "crypto";
import { ValidationError } from "./errors";

const TOKEN_BYTE_LENGTH = 32; // 32 bytes = ~43 characters when base64 encoded

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
export function generateWebhookToken(
  length: number = TOKEN_BYTE_LENGTH,
): string {
  if (typeof length !== "number" || length < 16 || length > 128) {
    throw new ValidationError("Token length must be between 16 and 128 bytes");
  }

  // Generate random bytes
  const tokenBytes = randomBytes(length);

  // Convert to URL-safe base64 (replaces + with -, / with _, removes padding =)
  return tokenBytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

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
export function isValidWebhookToken(token: unknown): token is string {
  if (typeof token !== "string" || token.trim().length === 0) {
    return false;
  }

  // URL-safe base64 characters: A-Z, a-z, 0-9, -, _
  const urlSafeBase64Pattern = /^[A-Za-z0-9_-]+$/;
  return urlSafeBase64Pattern.test(token);
}
