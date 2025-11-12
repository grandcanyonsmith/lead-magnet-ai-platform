import { randomBytes } from 'crypto';

/**
 * Generate a secure webhook token using cryptographically secure random bytes
 * Returns a URL-safe base64 encoded string (32 bytes = ~43 characters)
 */
export function generateWebhookToken(): string {
  // Generate 32 random bytes
  const tokenBytes = randomBytes(32);
  
  // Convert to URL-safe base64 (replaces + with -, / with _, removes padding =)
  return tokenBytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

