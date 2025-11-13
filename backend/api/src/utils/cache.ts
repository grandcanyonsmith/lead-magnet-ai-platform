/**
 * Simple in-memory cache for API responses.
 * Provides caching for GET requests to improve performance.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxSize: number;
  private defaultTTL: number; // milliseconds

  constructor(maxSize: number = 1000, defaultTTL: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get a value from cache.
   * Returns null if not found or expired.
   */
  get<T>(key: string): T | null {
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

    return entry.data as T;
  }

  /**
   * Set a value in cache.
   */
  set<T>(key: string, value: T, ttl?: number): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    };

    this.cache.set(key, entry);
  }

  /**
   * Delete a value from cache.
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Evict the oldest entry from cache.
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
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
  cleanup(): void {
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
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

// Export singleton instance
export const cache = new SimpleCache();

/**
 * Generate a cache key from request parameters.
 */
export function generateCacheKey(
  path: string,
  queryParams?: Record<string, any>,
  tenantId?: string
): string {
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
export function cacheMiddleware(
  ttl: number = 5 * 60 * 1000 // 5 minutes default
) {
  return async (event: any, tenantId?: string, next?: () => Promise<any>) => {
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
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Execute handler and cache result
    if (next) {
      const response = await next();
      
      // Only cache successful responses
      if (response && response.statusCode >= 200 && response.statusCode < 300) {
        cache.set(cacheKey, response, ttl);
      }

      return response;
    }

    return;
  };
}

