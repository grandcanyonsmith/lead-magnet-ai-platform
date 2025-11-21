import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { RouteResponse } from './routes';
export type { RouteResponse };
/**
 * Main router function.
 * Uses simplified router to match requests to handlers.
 */
export declare const routerHandler: (event: APIGatewayProxyEventV2, tenantId?: string) => Promise<RouteResponse>;
//# sourceMappingURL=index.d.ts.map