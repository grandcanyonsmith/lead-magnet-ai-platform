import { RouteDefinition, RouteHandler, Middleware } from '../types/api';

/**
 * Fluent route builder for creating route definitions.
 * Provides a clean API for defining routes: route('GET', '/admin/workflows').handler(...).middleware(...)
 */
export class RouteBuilder {
  private route: Partial<RouteDefinition> = {};

  constructor(method: string, path: string) {
    this.route.method = method;
    this.route.path = path;
    this.route.requiresAuth = path.startsWith('/admin');
    this.route.priority = 1000;
  }

  /**
   * Set the route handler function.
   */
  handler(handler: RouteHandler): this {
    this.route.handler = handler;
    return this;
  }

  /**
   * Add middleware to the route.
   */
  middleware(...middlewares: Middleware[]): this {
    if (!this.route.middleware) {
      this.route.middleware = [];
    }
    this.route.middleware.push(...middlewares);
    return this;
  }

  /**
   * Set whether authentication is required (defaults to true for /admin routes).
   */
  requiresAuth(required: boolean): this {
    this.route.requiresAuth = required;
    return this;
  }

  /**
   * Set route priority (lower numbers = higher priority).
   */
  priority(priority: number): this {
    this.route.priority = priority;
    return this;
  }

  /**
   * Build the route definition.
   */
  build(): RouteDefinition {
    if (!this.route.handler) {
      throw new Error(`Route handler is required for ${this.route.method} ${this.route.path}`);
    }

    return {
      method: this.route.method!,
      path: this.route.path!,
      handler: this.route.handler,
      middleware: this.route.middleware,
      requiresAuth: this.route.requiresAuth,
      priority: this.route.priority,
    };
  }
}

/**
 * Helper function to create a route builder.
 * Usage: route('GET', '/admin/workflows').handler(...).build()
 */
export function route(method: string, path: string): RouteBuilder {
  return new RouteBuilder(method, path);
}

/**
 * Helper functions for common HTTP methods.
 */
export const get = (path: string) => route('GET', path);
export const post = (path: string) => route('POST', path);
export const put = (path: string) => route('PUT', path);
export const del = (path: string) => route('DELETE', path);
export const patch = (path: string) => route('PATCH', path);

