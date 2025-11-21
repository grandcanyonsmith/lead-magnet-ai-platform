/**
 * Rate limiting middleware
 */
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { RouteResponse } from '../routes';
/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    keyGenerator?: (event: APIGatewayProxyEventV2) => string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}
/**
 * Create rate limiting middleware
 */
export declare function createRateLimiter(config: RateLimitConfig): (event: APIGatewayProxyEventV2, handler: () => Promise<RouteResponse>) => Promise<RouteResponse>;
/**
 * Default rate limiters for common use cases
 */
export declare const rateLimiters: {
    /**
     * Strict rate limiter: 100 requests per 15 minutes
     */
    strict: (event: APIGatewayProxyEventV2, handler: () => Promise<RouteResponse>) => Promise<RouteResponse>;
    /**
     * Standard rate limiter: 1000 requests per hour
     */
    standard: (event: APIGatewayProxyEventV2, handler: () => Promise<RouteResponse>) => Promise<RouteResponse>;
    /**
     * Form submission rate limiter: 10 requests per hour per IP
     */
    formSubmission: (event: APIGatewayProxyEventV2, handler: () => Promise<RouteResponse>) => Promise<RouteResponse>;
};
//# sourceMappingURL=rateLimiter.d.ts.map