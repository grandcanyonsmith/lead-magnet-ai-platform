import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { logger } from './logger';

/**
 * Extract tenant ID from JWT claims with fallback logic.
 * Returns undefined if no tenant ID can be determined (for public routes).
 */
export function extractTenantId(event: APIGatewayProxyEventV2): string | undefined {
  const authorizer = (event.requestContext as any)?.authorizer;
  const claims = authorizer?.jwt?.claims || {};

  // Try custom tenant_id attribute first
  if (claims['custom:tenant_id']) {
    return claims['custom:tenant_id'] as string;
  }

  // Fallback to email normalization
  if (claims.email) {
    const tenantId = (claims.email as string).toLowerCase().replace(/@/g, '_').replace(/\./g, '_');
    logger.warn('Tenant ID missing from custom attribute, using email fallback', {
      email: claims.email,
      tenantId,
      path: event.rawPath,
    });
    return tenantId;
  }

  // Last resort: use sub (user UUID)
  if (claims.sub) {
    logger.warn('Tenant ID missing from custom attribute, using sub fallback', {
      sub: claims.sub,
      path: event.rawPath,
    });
    return claims.sub as string;
  }

  // No tenant ID available (public routes)
  return undefined;
}

