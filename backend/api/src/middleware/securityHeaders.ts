/**
 * Security headers middleware
 */

import { RouteResponse } from '../routes';

/**
 * Add security headers to response
 */
export function addSecurityHeaders(response: RouteResponse): RouteResponse {
  const headers = response.headers || {};

  // Prevent MIME type sniffing
  headers['X-Content-Type-Options'] = 'nosniff';

  // Prevent clickjacking
  headers['X-Frame-Options'] = 'DENY';

  // XSS protection (legacy but still useful)
  headers['X-XSS-Protection'] = '1; mode=block';

  // Strict Transport Security (HSTS) - only add if using HTTPS
  // Note: In API Gateway, this is handled at the CloudFront/CDN level
  // headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';

  // Content Security Policy
  headers['Content-Security-Policy'] = "default-src 'self'";

  // Referrer Policy
  headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';

  // Permissions Policy (formerly Feature Policy)
  headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()';

  return {
    ...response,
    headers,
  };
}

/**
 * Security headers middleware function
 */
export function securityHeadersMiddleware<T extends RouteResponse>(
  handler: () => Promise<T>
): Promise<T> {
  return handler().then((response) => addSecurityHeaders(response) as T);
}

