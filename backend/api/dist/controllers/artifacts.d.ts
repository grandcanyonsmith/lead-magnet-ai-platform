import { RouteResponse } from '../routes';
declare class ArtifactsController {
    list(_tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse>;
    get(_tenantId: string, artifactId: string): Promise<RouteResponse>;
    /**
     * Get artifact content by fetching directly from S3.
     * This endpoint proxies the artifact content to avoid presigned URL expiration issues.
     */
    getContent(_tenantId: string, artifactId: string): Promise<RouteResponse>;
}
export declare const artifactsController: ArtifactsController;
export {};
//# sourceMappingURL=artifacts.d.ts.map