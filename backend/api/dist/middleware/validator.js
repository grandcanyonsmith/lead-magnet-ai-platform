"use strict";
/**
 * Validation middleware for automatic request validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.querySchemas = void 0;
exports.validateRequest = validateRequest;
exports.createValidationMiddleware = createValidationMiddleware;
const zod_1 = require("zod");
const errors_1 = require("../utils/errors");
/**
 * Validate request body, query parameters, and path parameters
 */
function validateRequest(event, config) {
    const result = {};
    // Validate body
    if (config.body) {
        try {
            const rawBody = event.body ? JSON.parse(event.body) : undefined;
            result.body = config.body.parse(rawBody);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                throw new errors_1.ValidationError('Invalid request body', {
                    errors: error.errors.map((e) => ({
                        path: e.path.join('.'),
                        message: e.message,
                    })),
                });
            }
            throw new errors_1.ValidationError('Invalid JSON in request body');
        }
    }
    // Validate query parameters
    if (config.query) {
        try {
            result.query = config.query.parse(event.queryStringParameters || {});
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                throw new errors_1.ValidationError('Invalid query parameters', {
                    errors: error.errors.map((e) => ({
                        path: e.path.join('.'),
                        message: e.message,
                    })),
                });
            }
            throw new errors_1.ValidationError('Invalid query parameters');
        }
    }
    // Validate path parameters (extracted from route)
    if (config.params) {
        // Path parameters would need to be extracted from the route matcher
        // For now, this is a placeholder that can be extended
        try {
            // This would need to be populated from the router
            const pathParams = event.pathParameters || {};
            result.params = config.params.parse(pathParams);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                throw new errors_1.ValidationError('Invalid path parameters', {
                    errors: error.errors.map((e) => ({
                        path: e.path.join('.'),
                        message: e.message,
                    })),
                });
            }
            throw new errors_1.ValidationError('Invalid path parameters');
        }
    }
    return result;
}
/**
 * Create a validation middleware function
 */
function createValidationMiddleware(config) {
    return async (event, handler) => {
        // Validate request
        const validated = validateRequest(event, config);
        // Extract path parameters from route (this would be done by the router)
        const params = event.pathParameters || {};
        // Call handler with validated data
        return handler(validated.params || params, validated.body, validated.query || event.queryStringParameters || {}, undefined, // tenantId would be extracted by router
        undefined // context would be extracted by router
        );
    };
}
/**
 * Common query parameter schemas
 */
exports.querySchemas = {
    pagination: zod_1.z.object({
        limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional(),
        offset: zod_1.z.string().regex(/^\d+$/).transform(Number).optional(),
    }),
    id: zod_1.z.object({
        id: zod_1.z.string().min(1),
    }),
    status: zod_1.z.object({
        status: zod_1.z.string().min(1),
    }),
};
//# sourceMappingURL=validator.js.map