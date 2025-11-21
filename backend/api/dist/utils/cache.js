"use strict";
/**
 * Simple in-memory cache for API responses.
 * Provides caching for GET requests to improve performance.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cache = void 0;
exports.generateCacheKey = generateCacheKey;
exports.cacheMiddleware = cacheMiddleware;
class SimpleCache {
    constructor(maxSize = 1000, defaultTTL = 5 * 60 * 1000) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.defaultTTL = defaultTTL;
    }
    /**
     * Get a value from cache.
     * Returns null if not found or expired.
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        // Check if expired
        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }
    /**
     * Set a value in cache.
     */
    set(key, value, ttl) {
        // Evict oldest entries if cache is full
        if (this.cache.size >= this.maxSize) {
            this.evictOldest();
        }
        const entry = {
            data: value,
            timestamp: Date.now(),
            ttl: ttl || this.defaultTTL,
        };
        this.cache.set(key, entry);
    }
    /**
     * Delete a value from cache.
     */
    delete(key) {
        this.cache.delete(key);
    }
    /**
     * Clear all cache entries.
     */
    clear() {
        this.cache.clear();
    }
    /**
     * Evict the oldest entry from cache.
     */
    evictOldest() {
        let oldestKey = null;
        let oldestTimestamp = Infinity;
        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTimestamp) {
                oldestTimestamp = entry.timestamp;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }
    /**
     * Clean up expired entries.
     */
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                this.cache.delete(key);
            }
        }
    }
    /**
     * Get cache statistics.
     */
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
        };
    }
}
// Export singleton instance
exports.cache = new SimpleCache();
/**
 * Generate a cache key from request parameters.
 */
function generateCacheKey(path, queryParams, tenantId) {
    const parts = [path];
    if (tenantId) {
        parts.push(`tenant:${tenantId}`);
    }
    if (queryParams && Object.keys(queryParams).length > 0) {
        const sortedParams = Object.keys(queryParams)
            .sort()
            .map(key => `${key}=${queryParams[key]}`)
            .join('&');
        parts.push(sortedParams);
    }
    return parts.join('|');
}
/**
 * Cache middleware for GET requests.
 * Automatically caches responses and serves cached data when available.
 */
function cacheMiddleware(ttl = 5 * 60 * 1000 // 5 minutes default
) {
    return async (event, tenantId, next) => {
        // Only cache GET requests
        if (event.requestContext?.http?.method !== 'GET') {
            if (next) {
                return await next();
            }
            return;
        }
        const path = event.rawPath;
        const queryParams = event.queryStringParameters || {};
        const cacheKey = generateCacheKey(path, queryParams, tenantId);
        // Try to get from cache
        const cached = exports.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        // Execute handler and cache result
        if (next) {
            const response = await next();
            // Only cache successful responses
            if (response && response.statusCode >= 200 && response.statusCode < 300) {
                exports.cache.set(cacheKey, response, ttl);
            }
            return response;
        }
        return;
    };
}
//# sourceMappingURL=cache.js.map