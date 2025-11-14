/**
 * Validation middleware for automatic request validation
 */

import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { z, ZodSchema } from 'zod';
import { ValidationError } from '../utils/errors';
import { RouteResponse } from '../routes';

/**
 * Validation configuration for a route
 */
export interface ValidationConfig {
  body?: ZodSchema<any>;
  query?: ZodSchema<any>;
  params?: ZodSchema<any>;
}

/**
 * Validate request body, query parameters, and path parameters
 */
export function validateRequest(
  event: APIGatewayProxyEventV2,
  config: ValidationConfig
): {
  body?: any;
  query?: Record<string, string | undefined>;
  params?: Record<string, string>;
} {
  const result: {
    body?: any;
    query?: Record<string, string | undefined>;
    params?: Record<string, string>;
  } = {};

  // Validate body
  if (config.body) {
    try {
      const rawBody = event.body ? JSON.parse(event.body) : undefined;
      result.body = config.body.parse(rawBody);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid request body', {
          errors: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      throw new ValidationError('Invalid JSON in request body');
    }
  }

  // Validate query parameters
  if (config.query) {
    try {
      result.query = config.query.parse(event.queryStringParameters || {});
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid query parameters', {
          errors: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      throw new ValidationError('Invalid query parameters');
    }
  }

  // Validate path parameters (extracted from route)
  if (config.params) {
    // Path parameters would need to be extracted from the route matcher
    // For now, this is a placeholder that can be extended
    try {
      // This would need to be populated from the router
      const pathParams = (event as any).pathParameters || {};
      result.params = config.params.parse(pathParams);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid path parameters', {
          errors: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      throw new ValidationError('Invalid path parameters');
    }
  }

  return result;
}

/**
 * Create a validation middleware function
 */
export function createValidationMiddleware(config: ValidationConfig) {
  return async (
    event: APIGatewayProxyEventV2,
    handler: (
      params: Record<string, string>,
      body: any,
      query: Record<string, string | undefined>,
      tenantId?: string,
      context?: any
    ) => Promise<RouteResponse>
  ): Promise<RouteResponse> => {
    // Validate request
    const validated = validateRequest(event, config);

    // Extract path parameters from route (this would be done by the router)
    const params = (event as any).pathParameters || {};

    // Call handler with validated data
    return handler(
      validated.params || params,
      validated.body,
      validated.query || event.queryStringParameters || {},
      undefined, // tenantId would be extracted by router
      undefined // context would be extracted by router
    );
  };
}

/**
 * Common query parameter schemas
 */
export const querySchemas = {
  pagination: z.object({
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    offset: z.string().regex(/^\d+$/).transform(Number).optional(),
  }),
  id: z.object({
    id: z.string().min(1),
  }),
  status: z.object({
    status: z.string().min(1),
  }),
};

