import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { router } from './routes';
import { handleError } from './utils/errors';
import { logger } from './utils/logger';

export const handler = async (
  event: APIGatewayProxyEventV2 | any,
  context: Context
): Promise<APIGatewayProxyResultV2> => {
  // Check if this is a workflow generation job (async invocation)
  if (event.source === 'workflow-generation-job' && event.job_id) {
    console.log('[Handler] Processing workflow generation job', {
      jobId: event.job_id,
      tenantId: event.tenant_id,
    });
    
    try {
      const { workflowsController } = await import('./controllers/workflows');
      
      // Load job data if description/model are missing
      let description = event.description;
      let model = event.model || 'gpt-5';
      let tenantId = event.tenant_id;
      
      if (!description || !tenantId) {
        const { db } = await import('./utils/db');
        const JOBS_TABLE = process.env.JOBS_TABLE || 'leadmagnet-jobs';
        const job = await db.get(JOBS_TABLE, { job_id: event.job_id });
        
        if (!job) {
          throw new Error(`Job ${event.job_id} not found`);
        }
        
        description = description || job.description;
        model = model || job.model || 'gpt-5';
        tenantId = tenantId || job.tenant_id;
      }
      
      await workflowsController.processWorkflowGenerationJob(
        event.job_id,
        tenantId,
        description,
        model
      );
      
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Workflow generation job processed' }),
      };
    } catch (error: any) {
      console.error('[Handler] Error processing workflow generation job', {
        error: error.message,
        jobId: event.job_id,
        stack: error.stack,
      });
      throw error;
    }
  }

  // Normal API Gateway request
  logger.info('Incoming request', {
    path: (event as APIGatewayProxyEventV2).rawPath,
    method: (event as APIGatewayProxyEventV2).requestContext?.http?.method,
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

