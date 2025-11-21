"use strict";
/**
 * Rate limiting middleware
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiters = void 0;
exports.createRateLimiter = createRateLimiter;
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const env_1 = require("../utils/env");
/**
 * In-memory rate limit store (for single Lambda instance)
 * In production, use DynamoDB or Redis for distributed rate limiting
 */
const rateLimitStore = new Map();
/**
 * Clean up expired entries periodically
 */
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
        if (now > value.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}, 60000); // Clean up every minute
/**
 * Generate rate limit key from request
 */
function generateKey(event, config) {
    if (config.keyGenerator) {
        return config.keyGenerator(event);
    }
    // Default: use IP address or user ID
    const sourceIp = event.requestContext?.http?.sourceIp || 'unknown';
    const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
    return userId ? `user:${userId}` : `ip:${sourceIp}`;
}
/**
 * Check if request should be rate limited
 */
function checkRateLimit(key, config) {
    const now = Date.now();
    const entry = rateLimitStore.get(key);
    if (!entry || now > entry.resetTime) {
        // Create new entry
        const resetTime = now + config.windowMs;
        rateLimitStore.set(key, { count: 1, resetTime });
        return {
            allowed: true,
            remaining: config.maxRequests - 1,
            resetTime,
        };
    }
    // Increment count
    entry.count++;
    if (entry.count > config.maxRequests) {
        return {
            allowed: false,
            remaining: 0,
            resetTime: entry.resetTime,
        };
    }
    return {
        allowed: true,
        remaining: config.maxRequests - entry.count,
        resetTime: entry.resetTime,
    };
}
/**
 * Create rate limiting middleware
 */
function createRateLimiter(config) {
    return async (event, handler) => {
        // Skip rate limiting in development
        if (env_1.env.isDevelopment()) {
            return handler();
        }
        const key = generateKey(event, config);
        const result = checkRateLimit(key, config);
        if (!result.allowed) {
            logger_1.logger.warn('[Rate Limiter] Rate limit exceeded', {
                key,
                path: event.rawPath,
                method: event.requestContext?.http?.method,
            });
            throw new errors_1.RateLimitError('Rate limit exceeded. Please try again later.', {
                resetTime: new Date(result.resetTime).toISOString(),
                windowMs: config.windowMs,
                maxRequests: config.maxRequests,
            });
        }
        // Execute handler
        const response = await handler();
        // Update rate limit based on response if configured
        if (config.skipSuccessfulRequests && response.statusCode < 400) {
            const entry = rateLimitStore.get(key);
            if (entry) {
                entry.count = Math.max(0, entry.count - 1);
            }
        }
        if (config.skipFailedRequests && response.statusCode >= 400) {
            const entry = rateLimitStore.get(key);
            if (entry) {
                entry.count = Math.max(0, entry.count - 1);
            }
        }
        // Add rate limit headers to response
        const headers = response.headers || {};
        headers['X-RateLimit-Limit'] = String(config.maxRequests);
        headers['X-RateLimit-Remaining'] = String(result.remaining);
        headers['X-RateLimit-Reset'] = String(Math.ceil(result.resetTime / 1000));
        return {
            ...response,
            headers,
        };
    };
}
/**
 * Default rate limiters for common use cases
 */
exports.rateLimiters = {
    /**
     * Strict rate limiter: 100 requests per 15 minutes
     */
    strict: createRateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100,
    }),
    /**
     * Standard rate limiter: 1000 requests per hour
     */
    standard: createRateLimiter({
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 1000,
    }),
    /**
     * Form submission rate limiter: 10 requests per hour per IP
     */
    formSubmission: createRateLimiter({
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 10,
        keyGenerator: (event) => {
            const sourceIp = event.requestContext?.http?.sourceIp || 'unknown';
            return `form:${sourceIp}`;
        },
    }),
};
//# sourceMappingURL=rateLimiter.js.map