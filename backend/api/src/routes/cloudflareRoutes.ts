import { router } from "./router";
import { cloudflareController } from "../controllers/cloudflareController";

/**
 * Cloudflare DNS integration routes
 */
export function registerCloudflareRoutes(): void {
  // Connect Cloudflare account
  router.register(
    "POST",
    "/admin/settings/cloudflare/connect",
    async (_params, body, _query, _tenantId, context) => {
      return await cloudflareController.connect(
        _params,
        body,
        _query,
        _tenantId,
        context
      );
    },
    true // requires auth
  );

  // Get Cloudflare connection status
  router.register(
    "GET",
    "/admin/settings/cloudflare/status",
    async (_params, _body, _query, _tenantId, context) => {
      return await cloudflareController.getStatus(
        _params,
        _body,
        _query,
        _tenantId,
        context
      );
    },
    true // requires auth
  );

  // Create DNS records automatically
  router.register(
    "POST",
    "/admin/settings/cloudflare/dns/create",
    async (_params, body, _query, _tenantId, context) => {
      return await cloudflareController.createDNSRecords(
        _params,
        body,
        _query,
        _tenantId,
        context
      );
    },
    true // requires auth
  );

  // Disconnect Cloudflare account
  router.register(
    "POST",
    "/admin/settings/cloudflare/disconnect",
    async (_params, _body, _query, _tenantId, context) => {
      return await cloudflareController.disconnect(
        _params,
        _body,
        _query,
        _tenantId,
        context
      );
    },
    true // requires auth
  );
}
