import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { routerHandler } from './routes/index';
import { handleError } from './utils/errors';
import { logger } from './utils/logger';
import { extractTenantId } from './utils/tenantId';
import { handleWorkflowGenerationJob } from './handlers/workflowGenerationHandler';

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

  try {
    // Extract tenant ID (may be undefined for public routes)
    const tenantId = extractTenantId(apiEvent);

    // Route the request
    const result = await routerHandler(apiEvent, tenantId);

    // Format response
    const contentType = result.headers?.['Content-Type'] || 'application/json';
    const isTextContent = contentType.startsWith('text/') || contentType.includes('markdown');
    const body = isTextContent ? result.body : JSON.stringify(result.body);

    return {
      statusCode: result.statusCode || 200,
      headers: {
        'Content-Type': contentType,
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

    return {
      statusCode: errorResponse.statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorResponse.body),
    };
  }
};

