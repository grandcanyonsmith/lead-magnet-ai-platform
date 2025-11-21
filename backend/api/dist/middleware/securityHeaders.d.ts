/**
 * Security headers middleware
 */
import { RouteResponse } from '../routes';
/**
 * Add security headers to response
 */
export declare function addSecurityHeaders(response: RouteResponse): RouteResponse;
/**
 * Security headers middleware function
 */
export declare function securityHeadersMiddleware<T extends RouteResponse>(handler: () => Promise<T>): Promise<T>;
//# sourceMappingURL=securityHeaders.d.ts.map