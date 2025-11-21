/**
 * Validation middleware for automatic request validation
 */
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { z, ZodSchema } from 'zod';
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
export declare function validateRequest(event: APIGatewayProxyEventV2, config: ValidationConfig): {
    body?: any;
    query?: Record<string, string | undefined>;
    params?: Record<string, string>;
};
/**
 * Create a validation middleware function
 */
export declare function createValidationMiddleware(config: ValidationConfig): (event: APIGatewayProxyEventV2, handler: (params: Record<string, string>, body: any, query: Record<string, string | undefined>, tenantId?: string, context?: any) => Promise<RouteResponse>) => Promise<RouteResponse>;
/**
 * Common query parameter schemas
 */
export declare const querySchemas: {
    pagination: z.ZodObject<{
        limit: z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>;
        offset: z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>;
    }, "strip", z.ZodTypeAny, {
        limit?: number | undefined;
        offset?: number | undefined;
    }, {
        limit?: string | undefined;
        offset?: string | undefined;
    }>;
    id: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    status: z.ZodObject<{
        status: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: string;
    }, {
        status: string;
    }>;
};
//# sourceMappingURL=validator.d.ts.map