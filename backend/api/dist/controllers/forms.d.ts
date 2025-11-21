import { RouteResponse } from '../routes';
declare class FormsController {
    list(_tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse>;
    get(_tenantId: string, formId: string): Promise<RouteResponse>;
    getPublicForm(slug: string): Promise<RouteResponse>;
    submitForm(slug: string, body: any, sourceIp: string): Promise<RouteResponse>;
    create(tenantId: string, body: any): Promise<RouteResponse>;
    update(_tenantId: string, formId: string, body: any): Promise<RouteResponse>;
    delete(_tenantId: string, formId: string): Promise<RouteResponse>;
    generateCSS(tenantId: string, body: any): Promise<RouteResponse>;
    refineCSS(tenantId: string, body: any): Promise<RouteResponse>;
}
export declare const formsController: FormsController;
export {};
//# sourceMappingURL=forms.d.ts.map