import { z } from "zod";
import { RouteResponse } from "../routes";
import {
  ApiError,
  InternalServerError,
  ValidationError,
} from "../utils/errors";
import { logger } from "../utils/logger";
import { RequestContext } from "../routes/router";
import { runShellToolLoop } from "../services/shellToolLoopService";
import { shellAbuseControlService } from "../services/shellAbuseControlService";
import { env } from "../utils/env";

const shellToolRequestSchema = z.object({
  input: z.string().min(1),
  model: z.string().optional(),
  instructions: z.string().optional(),
  max_steps: z.number().int().min(1).max(25).optional(),
});

class ShellToolController {
  async run(
    _params: Record<string, string>,
    body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    try {
      const parsed = shellToolRequestSchema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.message);
      }

      const sourceIp = context?.sourceIp || "unknown";
      logger.info("[ShellTool] Request", { sourceIp });

      // Abuse controls (fail closed for public RCE surface)
      await shellAbuseControlService.consumeIpToken({
        sourceIp,
        limitPerHour: env.shellToolIpLimitPerHour,
      });

      const slot = await shellAbuseControlService.acquireGlobalSlot({
        maxInFlight: env.shellToolMaxInFlight,
        waitMs: env.shellToolQueueWaitMs,
      });

      let result;
      try {
        result = await runShellToolLoop({
          input: parsed.data.input,
          model: parsed.data.model,
          instructions: parsed.data.instructions,
          maxSteps: parsed.data.max_steps,
        });
      } finally {
        await slot.release();
      }

      return {
        statusCode: 200,
        body: {
          response_id: result.responseId,
          output_text: result.outputText,
        },
      };
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      logger.error("[ShellTool] Error", {
        error: error?.message || String(error),
        stack: error?.stack,
      });
      throw new InternalServerError("Failed to run shell tool", {
        originalError: error?.message || String(error),
      });
    }
  }
}

export const shellToolController = new ShellToolController();
