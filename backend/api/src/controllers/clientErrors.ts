import { RouteResponse } from "../routes";
import { ApiError } from "../utils/errors";
import { logger } from "../utils/logger";
import { RequestContext } from "../routes/router";
import { reportClientError } from "../services/errorReportingService";

class ClientErrorsController {
  async report(
    tenantId: string,
    body: any,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    if (!body || typeof body !== "object") {
      throw new ApiError("Invalid payload", 400);
    }

    const message = String(
      (body as any).message || (body as any).error?.message || "",
    ).trim();
    if (!message) {
      throw new ApiError("Missing required field: message", 400);
    }

    const sourceIp = context?.sourceIp;
    const requestId = (context?.event as any)?.requestContext?.requestId;
    const userId = context?.auth?.actingUserId || context?.auth?.realUserId;

    logger.info("[ClientErrors] Received client error report", {
      tenantId,
      userId,
      sourceIp,
      requestId,
      message,
    });

    const { errorId } = await reportClientError({
      tenantId,
      userId,
      sourceIp,
      requestId,
      payload: body,
    });

    return {
      statusCode: 200,
      body: { received: true, error_id: errorId },
    };
  }
}

export const clientErrorsController = new ClientErrorsController();
