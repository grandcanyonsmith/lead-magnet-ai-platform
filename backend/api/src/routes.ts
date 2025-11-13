/**
 * @deprecated This file is kept for backward compatibility.
 * The router has been moved to ./routes/index.ts
 * RouteResponse interface is exported here for backward compatibility.
 */

export interface RouteResponse {
  statusCode: number;
  body: any;
  headers?: Record<string, string>;
}

// Re-export router from new location for backward compatibility
export { router } from './routes/index';
