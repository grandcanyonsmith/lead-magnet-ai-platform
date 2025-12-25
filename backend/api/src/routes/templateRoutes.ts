import { templatesController } from "../controllers/templates";
import { router } from "./router";
import { logger } from "../utils/logger";

/**
 * Template-related admin routes.
 */
export function registerTemplateRoutes(): void {
  // List templates
  router.register(
    "GET",
    "/admin/templates",
    async (_params, _body, query, tenantId) => {
      return await templatesController.list(tenantId!, query);
    },
  );

  // Create template
  router.register(
    "POST",
    "/admin/templates",
    async (_params, body, _query, tenantId) => {
      return await templatesController.create(tenantId!, body);
    },
  );

  // Generate template with AI
  router.register(
    "POST",
    "/admin/templates/generate",
    async (_params, body, _query, tenantId) => {
      logger.info("[Router] Matched /admin/templates/generate route");
      return await templatesController.generateWithAI(tenantId!, body);
    },
  );

  // Refine template with AI
  router.register(
    "POST",
    "/admin/templates/refine",
    async (_params, body, _query, tenantId) => {
      logger.info("[Router] Matched /admin/templates/refine route");
      return await templatesController.refineWithAI(tenantId!, body);
    },
  );

  // Get template
  router.register(
    "GET",
    "/admin/templates/:id",
    async (params, _body, _query, tenantId) => {
      return await templatesController.get(tenantId!, params.id);
    },
  );

  // Update template
  router.register(
    "PUT",
    "/admin/templates/:id",
    async (params, body, _query, tenantId) => {
      return await templatesController.update(tenantId!, params.id, body);
    },
  );

  // Delete template
  router.register(
    "DELETE",
    "/admin/templates/:id",
    async (params, _body, _query, tenantId) => {
      return await templatesController.delete(tenantId!, params.id);
    },
  );
}
