/**
 * Simple in-memory cache for API responses.
 * Provides caching for GET requests to improve performance.
 */
declare class SimpleCache {
    private cache;
    private maxSize;
    private defaultTTL;
    constructor(maxSize?: number, defaultTTL?: number);
    /**
     * Get a value from cache.
     * Returns null if not found or expired.
     */
    get<T>(key: string): T | null;
    /**
     * Set a value in cache.
     */
    set<T>(key: string, value: T, ttl?: number): void;
    /**
     * Delete a value from cache.
     */
    delete(key: string): void;
    /**
     * Clear all cache entries.
     */
    clear(): void;
    /**
     * Evict the oldest entry from cache.
     */
    private evictOldest;
    /**
     * Clean up expired entries.
     */
    cleanup(): void;
    /**
     * Get cache statistics.
     */
    getStats(): {
        size: number;
        maxSize: number;
    };
}
export declare const cache: SimpleCache;
/**
 * Generate a cache key from request parameters.
 */
export declare function generateCacheKey(path: string, queryParams?: Record<string, any>, tenantId?: string): string;
/**
 * Cache middleware for GET requests.
 * Automatically caches responses and serves cached data when available.
 */
export declare function cacheMiddleware(ttl?: number): (event: any, tenantId?: string, next?: () => Promise<any>) => Promise<any>;
export {};
//# sourceMappingURL=cache.d.ts.map