/**
 * CORS handler for Lambda Function URLs
 * Use this if you're using Lambda Function URLs instead of API Gateway
 */

export interface CORSConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  allowCredentials?: boolean;
}

const DEFAULT_CORS_CONFIG: CORSConfig = {
  allowedOrigins: ['*'], // Allow all origins
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Session-Id'],
  allowCredentials: false,
};

export function handleCORS(
  origin: string | undefined,
  config: CORSConfig = DEFAULT_CORS_CONFIG
): { [key: string]: string } {
  const headers: { [key: string]: string } = {};

  // Determine the origin to return
  let allowedOrigin: string;
  
  if (config.allowedOrigins.includes('*')) {
    // If wildcard is allowed and credentials are not used, return *
    allowedOrigin = config.allowCredentials ? origin || '*' : '*';
  } else if (origin && config.allowedOrigins.includes(origin)) {
    // If origin is in allowed list, return it
    allowedOrigin = origin;
  } else if (config.allowedOrigins.length > 0) {
    // Default to first allowed origin if origin doesn't match
    allowedOrigin = config.allowedOrigins[0];
  } else {
    allowedOrigin = '*';
  }

  // Set CORS headers - only set once!
  headers['Access-Control-Allow-Origin'] = allowedOrigin;
  headers['Access-Control-Allow-Methods'] = config.allowedMethods.join(', ');
  headers['Access-Control-Allow-Headers'] = config.allowedHeaders.join(', ');
  
  if (config.allowCredentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  
  headers['Access-Control-Max-Age'] = '86400'; // 24 hours

  return headers;
}

export function handlePreflightRequest(config: CORSConfig = DEFAULT_CORS_CONFIG) {
  return {
    statusCode: 204,
    headers: handleCORS(undefined, config),
    body: '',
  };
}

