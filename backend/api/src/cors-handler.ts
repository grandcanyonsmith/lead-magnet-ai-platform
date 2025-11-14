/**
 * CORS handler for Lambda Function URLs
 * Use this if you're using Lambda Function URLs instead of API Gateway
 */

export interface CORSConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  allowCredentials?: boolean;
  maxAge?: number;
}

/**
 * Get allowed origins from environment or use defaults
 */
function getAllowedOrigins(): string[] {
  const { env } = require('./utils/env');
  const corsOrigins = process.env.CORS_ORIGINS;
  
  if (corsOrigins) {
    return corsOrigins.split(',').map((origin: string) => origin.trim());
  }
  
  // Default: allow all origins in development, restrict in production
  if (env.isDevelopment()) {
    return ['*'];
  }
  
  // In production, default to empty array (no CORS) unless explicitly configured
  return [];
}

const DEFAULT_CORS_CONFIG: CORSConfig = {
  allowedOrigins: getAllowedOrigins(),
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Session-Id', 'x-view-mode', 'x-selected-customer-id'],
  allowCredentials: false,
  maxAge: 86400, // 24 hours
};

export function handleCORS(
  origin: string | undefined,
  config?: Partial<CORSConfig>
): { [key: string]: string } {
  const mergedConfig: CORSConfig = {
    ...DEFAULT_CORS_CONFIG,
    ...config,
    allowedOrigins: config?.allowedOrigins || DEFAULT_CORS_CONFIG.allowedOrigins,
  };

  const headers: { [key: string]: string } = {};

  // Determine the origin to return
  let allowedOrigin: string | undefined;
  
  if (mergedConfig.allowedOrigins.includes('*')) {
    // If wildcard is allowed and credentials are not used, return *
    allowedOrigin = mergedConfig.allowCredentials ? origin || '*' : '*';
  } else if (origin && mergedConfig.allowedOrigins.includes(origin)) {
    // If origin is in allowed list, return it
    allowedOrigin = origin;
  } else if (mergedConfig.allowedOrigins.length > 0) {
    // Default to first allowed origin if origin doesn't match
    allowedOrigin = mergedConfig.allowedOrigins[0];
  } else {
    // No CORS if no origins configured
    return headers;
  }

  // Set CORS headers
  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
    headers['Access-Control-Allow-Methods'] = mergedConfig.allowedMethods.join(', ');
    headers['Access-Control-Allow-Headers'] = mergedConfig.allowedHeaders.join(', ');
    headers['Access-Control-Max-Age'] = String(mergedConfig.maxAge || 86400);
    
    if (mergedConfig.allowCredentials) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }
  }

  return headers;
}

export function handlePreflightRequest(config: CORSConfig = DEFAULT_CORS_CONFIG) {
  return {
    statusCode: 204,
    headers: handleCORS(undefined, config),
    body: '',
  };
}

