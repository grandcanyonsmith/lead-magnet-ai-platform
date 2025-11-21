import { RouteResponse } from '../routes';
import { RequestContext } from '../routes/router';
declare class SettingsController {
    get(_params: Record<string, string>, _body: any, _query: Record<string, string | undefined>, _tenantId: string | undefined, context?: RequestContext): Promise<RouteResponse>;
    update(_params: Record<string, string>, body: any, _query: Record<string, string | undefined>, _tenantId: string | undefined, context?: RequestContext): Promise<RouteResponse>;
    /**
     * Regenerate webhook token for a user
     */
    regenerateWebhookToken(_params: Record<string, string>, _body: any, _query: Record<string, string | undefined>, _tenantId: string | undefined, context?: RequestContext): Promise<RouteResponse>;
    /**
     * Get webhook URL for a user
     */
    getWebhookUrl(_params: Record<string, string>, _body: any, _query: Record<string, string | undefined>, _tenantId: string | undefined, context?: RequestContext): Promise<RouteResponse>;
}
export declare const settingsController: SettingsController;
export {};
//# sourceMappingURL=settings.d.ts.map