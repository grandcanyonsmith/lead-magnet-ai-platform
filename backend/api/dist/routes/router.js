"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
/**
 * Simple Express-style router.
 * Automatically extracts path parameters, parses body, and handles common patterns.
 */
class SimpleRouter {
    constructor() {
        this.routes = [];
    }
    /**
     * Register a route.
     * Routes are stored in order, with more specific routes (more path segments) checked first.
     */
    register(method, path, handler, requiresAuth = path.startsWith('/admin')) {
        const route = { method, path, handler, requiresAuth };
        // Insert routes in order of specificity (more specific first)
        // This ensures /admin/workflows/:id matches before /admin/workflows
        const pathDepth = path.split('/').length;
        let insertIndex = this.routes.length;
        for (let i = 0; i < this.routes.length; i++) {
            const existingDepth = this.routes[i].path.split('/').length;
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
    async match(event, tenantId) {
        const method = event.requestContext.http.method;
        const path = event.rawPath;
        // Handle OPTIONS requests for CORS preflight
        if (method === 'OPTIONS') {
            return {
                statusCode: 200,
                body: {},
            };
        }
        // Extract auth context (for authenticated routes)
        const { extractAuthContext } = await Promise.resolve().then(() => __importStar(require('../utils/authContext')));
        const authContext = await extractAuthContext(event);
        // Try to match a route
        for (const route of this.routes) {
            if (route.method !== method && route.method !== '*') {
                continue;
            }
            const match = this.matchPath(route.path, path);
            if (!match) {
                continue;
            }
            // Check authentication requirement
            if (route.requiresAuth && !authContext) {
                throw new errors_1.ApiError('Please sign in to access this page', 401);
            }
            // Extract path parameters
            const params = match.params;
            // Parse body
            let body = undefined;
            if (event.body) {
                try {
                    body = JSON.parse(event.body);
                }
                catch (e) {
                    // If body is not JSON, pass as string
                    body = event.body;
                }
            }
            // Extract query parameters
            const query = event.queryStringParameters || {};
            // Create request context with auth
            const context = {
                sourceIp: event.requestContext.http.sourceIp,
                event,
                auth: authContext || undefined,
            };
            // For backward compatibility, use customerId as tenantId if available
            const effectiveTenantId = authContext?.customerId || tenantId;
            // Execute handler
            return await route.handler(params, body, query, effectiveTenantId, context);
        }
        logger_1.logger.warn('[Router] No route matched', {
            method,
            path,
            routeCount: this.routes.length,
        });
        throw new errors_1.ApiError("This page doesn't exist", 404);
    }
    /**
     * Match a route path pattern against a request path.
     * Supports :param syntax for path parameters.
     */
    matchPath(pattern, path) {
        // Extract parameter names first (before modifying the pattern)
        const paramNames = [];
        const paramMatches = pattern.matchAll(/:([^/]+)/g);
        for (const m of paramMatches) {
            paramNames.push(m[1]);
        }
        // Convert pattern to regex
        // Strategy: Escape special chars except : and *, then replace :param and *
        // This ensures capture group parentheses aren't escaped
        let regexPattern = pattern
            .replace(/[.+?^${}|[\]\\]/g, '\\$&') // Escape special chars (excluding :, *, and () which we add)
            .replace(/:[^/]+/g, '([^/]+)') // Replace :param with capture group
            .replace(/\*/g, '.*'); // Replace * with .*
        const regex = new RegExp(`^${regexPattern}$`);
        const match = path.match(regex);
        if (!match) {
            return null;
        }
        // Extract parameter values from match groups
        const params = {};
        paramNames.forEach((name, index) => {
            params[name] = match[index + 1];
        });
        return { params };
    }
}
// Export singleton instance
exports.router = new SimpleRouter();
//# sourceMappingURL=router.js.map