import { RouteResponse } from '../routes';
import { RequestContext } from '../routes/router';
/**
 * Files Controller
 * Handles file upload, listing, retrieval, deletion, and search
 */
declare class FilesController {
    /**
     * Upload a file
     * POST /files
     */
    upload(_params: Record<string, string>, body: any, _query: Record<string, string | undefined>, _tenantId: string | undefined, context?: RequestContext): Promise<RouteResponse>;
    /**
     * List files for current customer
     * GET /files
     */
    list(_params: Record<string, string>, _body: any, query: Record<string, string | undefined>, _tenantId: string | undefined, context?: RequestContext): Promise<RouteResponse>;
    /**
     * Get file metadata
     * GET /files/:fileId
     */
    get(params: Record<string, string>, _body: any, _query: Record<string, string | undefined>, _tenantId: string | undefined, context?: RequestContext): Promise<RouteResponse>;
    /**
     * Delete a file
     * DELETE /files/:fileId
     */
    delete(params: Record<string, string>, _body: any, _query: Record<string, string | undefined>, _tenantId: string | undefined, context?: RequestContext): Promise<RouteResponse>;
    /**
     * Search files using OpenAI
     * POST /files/search
     */
    search(_params: Record<string, string>, body: any, _query: Record<string, string | undefined>, _tenantId: string | undefined, context?: RequestContext): Promise<RouteResponse>;
}
export declare const filesController: FilesController;
export {};
//# sourceMappingURL=files.d.ts.map