import { router } from "./router";
import { cuaController } from "../controllers/cuaController";
import { logger } from "../utils/logger";

export function registerCUARoutes(): void {
  router.register(
    "POST",
    "/admin/cua/execute",
    async (params, body, query, tenantId, context) => {
      logger.info("[Router] Matched /admin/cua/execute route");
      
      // We need to bypass the default response handling to support streaming.
      // The router.register expects a Promise<ApiResponse>.
      // But we want to stream directly to the underlying response.
      // The `context` might contain the Express `res` object if passed.
      // Let's check `backend/api/src/routes/router.ts`.
      
      // If we can't access `res` directly, we might need a custom handler registration
      // outside of `router.register` wrapper.
      
      // Assuming context has `res` (it's often passed in Express adapters).
      const res = (context as any)?.res;
      
      if (res) {
          await cuaController.execute(tenantId!, body, res);
          // Return undefined or special symbol to indicate response handled?
          // The router might try to send response again.
          // We need to check router implementation.
          return { handled: true }; 
      }
      
      return await cuaController.execute(tenantId!, body);
    }
  );
}

