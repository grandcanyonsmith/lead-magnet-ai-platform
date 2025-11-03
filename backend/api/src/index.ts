import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { router } from './routes';
import { handleError } from './utils/errors';
import { logger } from './utils/logger';

export const handler = async (
  event: APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyResultV2> => {
  logger.info('Incoming request', {
    path: event.rawPath,
    method: event.requestContext.http.method,
    requestId: context.awsRequestId,
  });

  try {
    // Extract tenant_id from JWT claims if authenticated
    const authorizer = (event.requestContext as any).authorizer;
    const claims = authorizer?.jwt?.claims || {};
    
    // Log claims for debugging (remove sensitive data in production)
    logger.info('JWT Claims', {
      hasAuthorizer: !!authorizer,
      claimKeys: Object.keys(claims),
      hasCustomTenantId: !!claims['custom:tenant_id'],
      hasEmail: !!claims.email,
      hasSub: !!claims.sub,
      rawClaims: claims, // Log all claims for debugging
    });
    
    // Try to get tenant_id from custom attribute
    let tenantId = claims['custom:tenant_id'] as string;
    
    // Fallback: if tenant_id is missing, derive it from email or sub
    if (!tenantId) {
      const email = claims.email as string;
      const sub = claims.sub as string;
      
      if (email) {
        // Normalize email to match the format used in preSignUp Lambda
        tenantId = email.toLowerCase().replace(/@/g, '_').replace(/\./g, '_');
        logger.warn('Tenant ID missing from custom attribute, using email fallback', {
          email,
          tenantId,
          path: event.rawPath,
        });
      } else if (sub) {
        // Use sub (user UUID) as last resort
        tenantId = sub;
        logger.warn('Tenant ID missing from custom attribute, using sub fallback', {
          sub,
          tenantId,
          path: event.rawPath,
        });
      } else {
        logger.error('No tenant_id available and no fallback values found', {
          claims: Object.keys(claims),
          path: event.rawPath,
          authorizer: authorizer ? Object.keys(authorizer) : 'none',
        });
      }
    }
    
    // If still no tenantId and this is an admin route, return 401
    // But only for admin routes - public routes don't need tenantId
    const isAdminRoute = event.rawPath.startsWith('/admin');
    if (!tenantId && isAdminRoute) {
      logger.error('Admin route accessed without tenantId', {
        path: event.rawPath,
        claims: Object.keys(claims),
        hasAuthorizer: !!authorizer,
        email: claims.email,
        sub: claims.sub,
      });
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'Unauthorized',
          message: 'Please sign in to access this page',
        }),
      };
    }
    
    // Route the request
    const result = await router(event, tenantId);
    
    console.log('[Handler] Router returned result', {
      statusCode: result.statusCode,
      bodyType: typeof result.body,
      bodyKeys: result.body && typeof result.body === 'object' ? Object.keys(result.body) : 'not object',
      path: event.rawPath,
    });
    
    return {
      statusCode: result.statusCode || 200,
      headers: {
        'Content-Type': 'application/json',
        // CORS headers are handled by API Gateway corsPreflight configuration
      },
      body: JSON.stringify(result.body),
    };
  } catch (error) {
    logger.error('Request error', { error, path: event.rawPath });
    
    const errorResponse = handleError(error);
    
    return {
      statusCode: errorResponse.statusCode,
      headers: {
        'Content-Type': 'application/json',
        // CORS headers are handled by API Gateway corsPreflight configuration
      },
      body: JSON.stringify(errorResponse.body),
    };
  }
};

