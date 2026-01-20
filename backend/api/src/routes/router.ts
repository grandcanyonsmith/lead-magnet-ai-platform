import { APIGatewayProxyEventV2 } from "aws-lambda";
import { RouteResponse } from "./routes";
import { ApiError } from "../utils/errors";
import { logger } from "../utils/logger";
import { rateLimiters } from "../middleware/rateLimiter";

import { AuthContext } from "../utils/authContext";

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
export type SimpleRouteHandler<
  TBody = any,
  TQuery = Record<string, string | undefined>,
  TParams = Record<string, string>,
> = (
  params: TParams,
  body: TBody,
  query: TQuery,
  tenantId?: string,
  context?: RequestContext,
) => Promise<RouteResponse>;

/**
 * Route definition for simplified router.
 */
interface SimpleRoute {
  method: string;
  path: string;
  handler: SimpleRouteHandler;
  requiresAuth?: boolean;
}

/**
 * Simple Express-style router.
 * Automatically extracts path parameters, parses body, and handles common patterns.
 */
class SimpleRouter {
  private routes: SimpleRoute[] = [];

  /**
   * Register a route.
   * Routes are stored in order, with more specific routes (more path segments) checked first.
   */
  register(
    method: string,
    path: string,
    handler: SimpleRouteHandler,
    requiresAuth: boolean = path.startsWith("/admin"),
  ): void {
    const route: SimpleRoute = { method, path, handler, requiresAuth };

    // Insert routes in order of specificity (more specific first)
    // This ensures /admin/workflows/:id matches before /admin/workflows
    const pathDepth = path.split("/").length;
    let insertIndex = this.routes.length;
    for (let i = 0; i < this.routes.length; i++) {
      const existingDepth = this.routes[i].path.split("/").length;
      if (pathDepth > existingDepth) {
        insertIndex = i;
        break;
      }
    }
    this.routes.splice(insertIndex, 0, route);
  }

  /**
   * Match a request to a route and execute the handler.
   */
  async match(
    event: APIGatewayProxyEventV2,
    tenantId?: string,
  ): Promise<RouteResponse> {
    const method = event.requestContext.http.method;
    let path = event.rawPath;
    
    // Strip /api prefix if present (for local dev compatibility)
    if (path.startsWith('/api')) {
      path = path.substring(4);
    }

    // Handle OPTIONS requests for CORS preflight
    if (method === "OPTIONS") {
      return {
        statusCode: 200,
        body: {},
      };
    }

    // Extract auth context (for authenticated routes)
    const { extractAuthContext } = await import("../utils/authContext");
    const authContext = await extractAuthContext(event);

    // Match a route
    for (const route of this.routes) {
      if (route.method !== method && route.method !== "*") {
        continue;
      }

      const match = this.matchPath(route.path, path);
      if (!match) {
        continue;
      }

      // Check authentication requirement
      if (route.requiresAuth && !authContext) {
        throw new ApiError("Please sign in to access this page", 401);
      }

      // Extract path parameters
      const params = match.params;

      // Parse body
      let body: any = undefined;
      if (event.body) {
        try {
          body = JSON.parse(event.body);
        } catch (e) {
          // If body is not JSON, pass as string
          body = event.body;
        }
      }

      // Extract query parameters
      const query = event.queryStringParameters || {};

      // Create request context with auth
      const context: RequestContext & { res?: any } = {
        sourceIp: event.requestContext.http.sourceIp,
        event,
        auth: authContext || undefined,
        // Pass response object if available in original event/context
        res: (event as any).res
      };

      // For backward compatibility, use customerId as tenantId if available
      const effectiveTenantId = authContext?.customerId || tenantId;

      // Execute handler
      const executeHandler = () =>
        route.handler(
          params,
          body,
          query,
          effectiveTenantId,
          context,
        );

      // Apply rate limiting
      // Select appropriate rate limiter based on route path
      let limiter = rateLimiters.standard;
      
      // Use form submission limiter (10 req/hour per IP) for form submissions to prevent spam
      if (route.path === "/v1/forms/:slug/submit") {
        limiter = rateLimiters.formSubmission;
      }

      return await limiter(event, executeHandler);
    }

    logger.warn("[Router] No route matched", {
      method,
      path,
      routeCount: this.routes.length,
    });

    throw new ApiError("This page doesn't exist", 404);
  }

  /**
   * Match a route path pattern against a request path.
   * Supports :param syntax for path parameters.
   */
  private matchPath(
    pattern: string,
    path: string,
  ): { params: Record<string, string> } | null {
    // Extract parameter names first (before modifying the pattern)
    const paramNames: string[] = [];
    const paramMatches = pattern.matchAll(/:([^/]+)/g);
    for (const m of paramMatches) {
      paramNames.push(m[1]);
    }

    // Convert pattern to regex
    // Strategy: Escape special chars except : and *, then replace :param and *
    // This ensures capture group parentheses aren't escaped
    const regexPattern = pattern
      .replace(/[.+?^${}|[\]\\]/g, "\\$&") // Escape special chars (excluding :, *, and () which we add)
      .replace(/:[^/]+/g, "([^/]+)") // Replace :param with capture group
      .replace(/\*/g, ".*"); // Replace * with .*

    const regex = new RegExp(`^${regexPattern}$`);
    const match = path.match(regex);

    if (!match) {
      return null;
    }

    // Extract parameter values from match groups
    const params: Record<string, string> = {};
    paramNames.forEach((name, index) => {
      params[name] = match[index + 1];
    });

    return { params };
  }
}

// Export singleton instance
export const router = new SimpleRouter();
