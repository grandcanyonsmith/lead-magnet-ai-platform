import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { RouteResponse } from './routes';
import { AuthContext } from '../utils/authContext';
/**
 * Request context with commonly needed values.
 */
export interface RequestContext {
    sourceIp: string;
    event: APIGatewayProxyEventV2;
    auth?: AuthContext;
}
/**
 * Simplified route handler type.
 * Path parameters, parsed body, query params, tenantId, and context are automatically provided.
 */
export type SimpleRouteHandler<TBody = any, TQuery = Record<string, string | undefined>, TParams = Record<string, string>> = (params: TParams, body: TBody, query: TQuery, tenantId?: string, context?: RequestContext) => Promise<RouteResponse>;
/**
 * Simple Express-style router.
 * Automatically extracts path parameters, parses body, and handles common patterns.
 */
declare class SimpleRouter {
    private routes;
    /**
     * Register a route.
     * Routes are stored in order, with more specific routes (more path segments) checked first.
     */
    register(method: string, path: string, handler: SimpleRouteHandler, requiresAuth?: boolean): void;
    /**
     * Match a request to a route and execute the handler.
     */
    match(event: APIGatewayProxyEventV2, tenantId?: string): Promise<RouteResponse>;
    /**
     * Match a route path pattern against a request path.
     * Supports :param syntax for path parameters.
     */
    private matchPath;
}
export declare const router: SimpleRouter;
export {};
//# sourceMappingURL=router.d.ts.map