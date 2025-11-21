import { RouteResponse } from '../routes';
declare class TemplatesController {
    list(_tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse>;
    get(_tenantId: string, templateId: string): Promise<RouteResponse>;
    create(tenantId: string, body: any): Promise<RouteResponse>;
    update(_tenantId: string, templateId: string, body: any): Promise<RouteResponse>;
    delete(_tenantId: string, templateId: string): Promise<RouteResponse>;
    private extractPlaceholders;
    refineWithAI(tenantId: string, body: any): Promise<RouteResponse>;
    generateWithAI(tenantId: string, body: any): Promise<RouteResponse>;
}
export declare const templatesController: TemplatesController;
export {};
//# sourceMappingURL=templates.d.ts.map