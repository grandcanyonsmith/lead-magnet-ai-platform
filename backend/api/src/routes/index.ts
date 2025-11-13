import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { RouteResponse } from './routes';
import { router } from './router';
import { registerPublicRoutes } from './publicRoutes';
import { registerWorkflowRoutes } from './workflowRoutes';
import { registerFormRoutes } from './formRoutes';
import { registerTemplateRoutes } from './templateRoutes';
import { registerJobRoutes } from './jobRoutes';
import { registerAdminRoutes } from './adminRoutes';

// Register all routes on module load
registerPublicRoutes();
registerWorkflowRoutes();
registerFormRoutes();
registerTemplateRoutes();
registerJobRoutes();
registerAdminRoutes();

/**
 * Main router function.
 * Uses simplified router to match requests to handlers.
 */
export const routerHandler = async (
  event: APIGatewayProxyEventV2,
  tenantId?: string
): Promise<RouteResponse> => {
  return await router.match(event, tenantId);
};

