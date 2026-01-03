import { router } from "./router";
import { shellController } from "../controllers/shellController";
import { logger } from "../utils/logger";

export function registerShellRoutes(): void {
  router.register(
    "POST",
    "/admin/shell/execute",
    async (_params, body, _query, tenantId, context) => {
      logger.info("[Router] Matched /admin/shell/execute route");
      
      const res = (context as any)?.res;
      
      if (res) {
          await shellController.execute(tenantId!, body, res);
          return { handled: true }; 
      }
      
      return await shellController.execute(tenantId!, body);
    }
  );
}
