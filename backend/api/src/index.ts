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
    const tenantId = authorizer?.jwt?.claims?.['custom:tenant_id'] as string;
    
    // Route the request
    const result = await router(event, tenantId);
    
    return {
      statusCode: result.statusCode || 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
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
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(errorResponse.body),
    };
  }
};

