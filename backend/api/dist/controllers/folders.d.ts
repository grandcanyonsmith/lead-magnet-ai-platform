import { RouteResponse } from '../routes';
import { BaseController } from './baseController';
declare class FoldersController extends BaseController {
    list(tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse>;
    get(tenantId: string, folderId: string): Promise<RouteResponse>;
    create(tenantId: string, body: any): Promise<RouteResponse>;
    update(tenantId: string, folderId: string, body: any): Promise<RouteResponse>;
    delete(tenantId: string, folderId: string): Promise<RouteResponse>;
}
export declare const foldersController: FoldersController;
export {};
//# sourceMappingURL=folders.d.ts.map