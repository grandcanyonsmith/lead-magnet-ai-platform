import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { RouteDefinition, RouteMatch, PathParams } from '../types/api';
import { logger } from '../utils/logger';

/**
 * Route registry for managing and matching routes.
 * Replaces the large if/else chain in routes.ts with a declarative system.
 */
export class RouteRegistry {
  private routes: RouteDefinition[] = [];

  /**
   * Register a route definition.
   */
  register(route: RouteDefinition): void {
    // Set default priority if not specified (lower = higher priority)
    if (route.priority === undefined) {
      route.priority = 1000;
    }

    this.routes.push(route);

    // Sort by priority (lower numbers first)
    this.routes.sort((a, b) => (a.priority || 1000) - (b.priority || 1000));
  }

  /**
   * Register multiple routes at once.
   */
  registerMany(routes: RouteDefinition[]): void {
    routes.forEach((route) => this.register(route));
  }

  /**
   * Match a request to a route.
   * Returns the matched route and extracted path parameters.
   */
  match(event: APIGatewayProxyEventV2): RouteMatch | null {
    const method = event.requestContext.http.method;
    const path = event.rawPath;

    // Handle OPTIONS requests for CORS preflight
    if (method === 'OPTIONS') {
      return {
        route: {
          method: 'OPTIONS',
          path: '*',
          handler: async () => ({
            statusCode: 200,
            body: {},
          }),
        },
        params: {},
      };
    }

    // Try to match routes in priority order
    for (const route of this.routes) {
      const match = this.matchRoute(route, method, path);
      if (match) {
        logger.debug('[RouteRegistry] Route matched', {
          method,
          path,
          routePath: route.path,
          params: match.params,
        });
        return {
          route,
          params: match.params,
        };
      }
    }

    return null;
  }

  /**
   * Check if a route matches the given method and path.
   * Returns path parameters if matched, null otherwise.
   */
  private matchRoute(
    route: RouteDefinition,
    method: string,
    path: string
  ): { params: PathParams } | null {
    // Method must match
    if (route.method !== method && route.method !== '*') {
      return null;
    }

    // Convert route path pattern to regex
    const pattern = this.pathToRegex(route.path);
    const match = path.match(pattern);

    if (!match) {
      return null;
    }

    // Extract path parameters
    const params: PathParams = {};
    const paramNames = this.extractParamNames(route.path);
    paramNames.forEach((name, index) => {
      params[name] = match[index + 1];
    });

    return { params };
  }

  /**
   * Convert a route path pattern to a regex.
   * Supports :param syntax for path parameters.
   * Example: '/admin/workflows/:id' -> /^\/admin\/workflows\/([^/]+)$/
   */
  private pathToRegex(pathPattern: string): RegExp {
    // Escape special regex characters except : and *
    let regex = pathPattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      // Replace :param with ([^/]+) to match any non-slash characters
      .replace(/:[^/]+/g, '([^/]+)')
      // Replace * with .* to match anything
      .replace(/\*/g, '.*');

    // Anchor to start and end
    regex = `^${regex}$`;

    return new RegExp(regex);
  }

  /**
   * Extract parameter names from a route path pattern.
   * Example: '/admin/workflows/:id' -> ['id']
   */
  private extractParamNames(pathPattern: string): string[] {
    const matches = pathPattern.matchAll(/:([^/]+)/g);
    return Array.from(matches, (m) => m[1]);
  }

  /**
   * Get all registered routes (for debugging).
   */
  getAllRoutes(): RouteDefinition[] {
    return [...this.routes];
  }

  /**
   * Clear all registered routes (useful for testing).
   */
  clear(): void {
    this.routes = [];
  }
}

// Export singleton instance
export const routeRegistry = new RouteRegistry();

