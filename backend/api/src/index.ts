import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { routerHandler } from './routes/index';
import { handleError } from './utils/errors';
import { logger } from './utils/logger';
import { extractTenantId } from './utils/tenantId';
import { handleWorkflowGenerationJob } from './handlers/workflowGenerationHandler';
import { handleCORS } from './cors-handler';

export const handler = async (
  event: APIGatewayProxyEventV2 | any,
  context: Context
): Promise<APIGatewayProxyResultV2> => {
  // Handle workflow generation job (async Lambda invocation)
  if (event.source === 'workflow-generation-job' && event.job_id) {
    try {
      return await handleWorkflowGenerationJob(event);
    } catch (error: any) {
      logger.error('Error processing workflow generation job', {
        error: error.message,
        jobId: event.job_id,
        stack: error.stack,
      });
      throw error;
    }
  }

  // Normal API Gateway request
  const apiEvent = event as APIGatewayProxyEventV2;
  logger.info('Incoming request', {
    path: apiEvent.rawPath,
    method: apiEvent.requestContext?.http?.method,
    requestId: context.awsRequestId,
  });

  // Handle CORS preflight requests
  if (apiEvent.requestContext?.http?.method === 'OPTIONS') {
    const corsHeaders = handleCORS(
      apiEvent.headers?.origin || apiEvent.headers?.Origin,
      {
        allowedOrigins: ['*'],
        allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Session-Id', 'x-view-mode', 'x-selected-customer-id'],
        allowCredentials: false,
      }
    );
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // Extract tenant ID (may be undefined for public routes)
    const tenantId = extractTenantId(apiEvent);

    // Route the request
    const result = await routerHandler(apiEvent, tenantId);

    // Format response
    const contentType = result.headers?.['Content-Type'] || 'application/json';
    const isTextContent = contentType.startsWith('text/') || contentType.includes('markdown');
    const body = isTextContent ? result.body : JSON.stringify(result.body);

    // Add CORS headers to all responses
    const origin = apiEvent.headers?.origin || apiEvent.headers?.Origin;
    const corsHeaders = handleCORS(origin, {
      allowedOrigins: ['*'],
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Session-Id', 'x-view-mode', 'x-selected-customer-id'],
      allowCredentials: false,
    });

    return {
      statusCode: result.statusCode || 200,
      headers: {
        'Content-Type': contentType,
        ...corsHeaders,
        ...result.headers,
      },
      body,
    };
  } catch (error) {
    logger.error('Request error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      path: apiEvent.rawPath,
    });

    const errorResponse = handleError(error);

    // Add CORS headers to error responses
    const origin = apiEvent.headers?.origin || apiEvent.headers?.Origin;
    const corsHeaders = handleCORS(origin, {
      allowedOrigins: ['*'],
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Session-Id', 'x-view-mode', 'x-selected-customer-id'],
      allowCredentials: false,
    });

    return {
      statusCode: errorResponse.statusCode,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
      body: JSON.stringify(errorResponse.body),
    };
  }
};

