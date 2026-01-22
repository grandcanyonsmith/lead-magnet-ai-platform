import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { routerHandler } from './routes/index';
import { handleError } from './utils/errors';
import { logger } from './utils/logger';
import { handleWorkflowGenerationJob } from '@domains/workflows/handlers/workflowGenerationHandler';
import { handleWorkflowAIEditJob } from '@domains/workflows/handlers/workflowAIEditHandler';
import { handleCORS, CORSConfig } from './cors-handler';
import { addSecurityHeaders } from './middleware/securityHeaders';
import { initErrorReporting } from './services/errorReportingService';

// Initialize error reporting (hooks into handleError via setErrorTrackingHook)
initErrorReporting();

const PUBLIC_TRACKING_CORS_PATHS = new Set([
  "/v1/tracking/event",
  "/v1/tracking/recording-url",
]);

function normalizeCorsPath(path?: string): string {
  if (!path) return "";
  return path.startsWith("/api") ? path.slice(4) : path;
}

function getCorsConfigForPath(
  path?: string,
): Partial<CORSConfig> | undefined {
  const normalizedPath = normalizeCorsPath(path);
  if (PUBLIC_TRACKING_CORS_PATHS.has(normalizedPath)) {
    return { allowedOrigins: ["*"] };
  }
  return undefined;
}

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

  // Handle workflow AI edit job (async Lambda invocation)
  if (event.source === 'workflow-ai-edit-job' && event.job_id) {
    try {
      return await handleWorkflowAIEditJob(event);
    } catch (error: any) {
      logger.error('Error processing workflow AI edit job', {
        error: error.message,
        jobId: event.job_id,
        stack: error.stack,
      });
      throw error;
    }
  }

  // Handle HTML patch request (async Lambda invocation)
  if (event.source === 'html-patch-request' && event.patch_id) {
    try {
      const { handleHtmlPatchRequest } = await import('./controllers/htmlPatchHandler');
      return await handleHtmlPatchRequest(event);
    } catch (error: any) {
      logger.error('Error processing HTML patch request', {
        error: error.message,
        patchId: event.patch_id,
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
    const origin = apiEvent.headers?.origin || apiEvent.headers?.Origin;
    const corsConfig = getCorsConfigForPath(apiEvent.rawPath);
    const corsHeaders = handleCORS(origin, corsConfig);
    const securityHeaders = addSecurityHeaders({
      statusCode: 204,
      headers: corsHeaders,
      body: {},
    });
    return {
      statusCode: 204,
      headers: securityHeaders.headers,
      body: '',
    };
  }

  try {
    // Route the request
    // Router will extract auth context internally and use customerId as tenantId
    const result = await routerHandler(apiEvent, undefined);

    // Check for "handled" flag (e.g. streaming response handled directly via context.res)
    if (result.body && (result.body as any).handled) {
      return {
        statusCode: 200,
        handled: true,
      } as any;
    }

    // Format response
    const contentType = result.headers?.['Content-Type'] || 'application/json';
    const isTextContent = contentType.startsWith('text/') || contentType.includes('markdown');
    const body = isTextContent ? result.body : JSON.stringify(result.body);

    // Add CORS headers to all responses
    const origin = apiEvent.headers?.origin || apiEvent.headers?.Origin;
    const corsConfig = getCorsConfigForPath(apiEvent.rawPath);
    const corsHeaders = handleCORS(origin, corsConfig);

    // Add security headers
    const responseWithSecurity = addSecurityHeaders({
      statusCode: result.statusCode || 200,
      headers: {
        'Content-Type': contentType,
        ...corsHeaders,
        ...result.headers,
      },
      body: result.body,
    });

    return {
      statusCode: responseWithSecurity.statusCode,
      headers: responseWithSecurity.headers,
      body,
    };
  } catch (error) {
    logger.error('Request error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      path: apiEvent.rawPath,
      requestId: context.awsRequestId,
    });

    const errorResponse = handleError(error, {
      requestId: context.awsRequestId,
      path: apiEvent.rawPath,
      method: apiEvent.requestContext?.http?.method,
    });

    // Add CORS headers to error responses
    const origin = apiEvent.headers?.origin || apiEvent.headers?.Origin;
    const corsConfig = getCorsConfigForPath(apiEvent.rawPath);
    const corsHeaders = handleCORS(origin, corsConfig);
    
    // Add security headers
    const responseWithSecurity = addSecurityHeaders({
      statusCode: errorResponse.statusCode,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
      body: errorResponse.body,
    });

    return {
      statusCode: responseWithSecurity.statusCode,
      headers: responseWithSecurity.headers,
      body: JSON.stringify(responseWithSecurity.body),
    };
  }
};

