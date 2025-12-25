/**
 * Webhook Signature Verification
 * Verifies OpenAI webhook signatures using HMAC SHA-256
 */

import { createHmac } from "crypto";
import { logger } from "./logger";

/**
 * Verify OpenAI webhook signature
 * OpenAI uses Svix-style webhook signatures (HMAC SHA-256)
 *
 * @param payload - Raw request body as string
 * @param signature - Signature from 'svix-signature' header
 * @param secret - Webhook signing secret (starts with 'whsec_')
 * @returns true if signature is valid
 */
export function verifyOpenAIWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) {
    logger.warn("[Webhook Signature] Missing signature or secret");
    return false;
  }

  // Remove 'whsec_' prefix if present
  const secretKey = secret.startsWith("whsec_") ? secret.slice(6) : secret;

  try {
    // Parse the signature header (format: "v1,timestamp,signature")
    const parts = signature.split(",");
    if (parts.length !== 3) {
      logger.warn("[Webhook Signature] Invalid signature format", {
        signature,
      });
      return false;
    }

    const [version, timestamp, signatureHash] = parts;
    if (version !== "v1") {
      logger.warn("[Webhook Signature] Unsupported signature version", {
        version,
      });
      return false;
    }

    // Create the signed payload: timestamp.payload
    const signedPayload = `${timestamp}.${payload}`;

    // Compute HMAC SHA-256
    const hmac = createHmac("sha256", secretKey);
    hmac.update(signedPayload);
    const computedSignature = hmac.digest("base64");

    // Compare signatures (constant-time comparison)
    const isValid = computedSignature === signatureHash;

    if (!isValid) {
      logger.warn("[Webhook Signature] Signature verification failed", {
        computedLength: computedSignature.length,
        receivedLength: signatureHash.length,
      });
    }

    return isValid;
  } catch (error: any) {
    logger.error("[Webhook Signature] Error verifying signature", {
      error: error.message,
    });
    return false;
  }
}

/**
 * Extract signature from request headers
 * OpenAI sends signature in 'svix-signature' header
 */
export function extractSignatureFromHeaders(
  headers: Record<string, string | undefined>,
): string | null {
  // Check various possible header names (case-insensitive)
  const headerNames = [
    "svix-signature",
    "svix-signature",
    "x-svix-signature",
    "openai-signature",
    "x-openai-signature",
  ];

  for (const headerName of headerNames) {
    // Check exact match first
    if (headers[headerName]) {
      return headers[headerName] as string;
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
