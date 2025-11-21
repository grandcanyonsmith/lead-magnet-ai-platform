"use strict";
/**
 * CORS handler for Lambda Function URLs
 * Use this if you're using Lambda Function URLs instead of API Gateway
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCORS = handleCORS;
exports.handlePreflightRequest = handlePreflightRequest;
/**
 * Get allowed origins from environment or use defaults
 */
function getAllowedOrigins() {
    const { env } = require('./utils/env');
    const corsOrigins = process.env.CORS_ORIGINS;
    if (corsOrigins) {
        return corsOrigins.split(',').map((origin) => origin.trim());
    }
    // Default: allow all origins in development, restrict in production
    if (env.isDevelopment()) {
        return ['*'];
    }
    // In production, default to empty array (no CORS) unless explicitly configured
    return [];
}
const DEFAULT_CORS_CONFIG = {
    allowedOrigins: getAllowedOrigins(),
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Session-Id', 'x-view-mode', 'x-selected-customer-id'],
    allowCredentials: false,
    maxAge: 86400, // 24 hours
};
function handleCORS(origin, config) {
    const mergedConfig = {
        ...DEFAULT_CORS_CONFIG,
        ...config,
        allowedOrigins: config?.allowedOrigins || DEFAULT_CORS_CONFIG.allowedOrigins,
    };
    const headers = {};
    // Determine the origin to return
    let allowedOrigin;
    if (mergedConfig.allowedOrigins.includes('*')) {
        // If wildcard is allowed and credentials are not used, return *
        allowedOrigin = mergedConfig.allowCredentials ? origin || '*' : '*';
    }
    else if (origin && mergedConfig.allowedOrigins.includes(origin)) {
        // If origin is in allowed list, return it
        allowedOrigin = origin;
    }
    else if (mergedConfig.allowedOrigins.length > 0) {
        // Default to first allowed origin if origin doesn't match
        allowedOrigin = mergedConfig.allowedOrigins[0];
    }
    else {
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
function handlePreflightRequest(config = DEFAULT_CORS_CONFIG) {
    return {
        statusCode: 204,
        headers: handleCORS(undefined, config),
        body: '',
    };
}
//# sourceMappingURL=cors-handler.js.map