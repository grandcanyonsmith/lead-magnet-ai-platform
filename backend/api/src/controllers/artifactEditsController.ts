import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { RouteResponse } from "../routes";
import { RequestContext } from "../routes/router";
import { ApiError } from "../utils/errors";
import { env } from "../utils/env";
import { logger } from "../utils/logger";
import {
  ArtifactEditStatusPayload,
  artifactEditService,
  buildArtifactEditStatusPayload,
} from "../services/artifactEditService";

const lambdaClient = new LambdaClient({ region: env.awsRegion });

function isTerminalStatus(status: ArtifactEditStatusPayload["status"]): boolean {
  return status === "completed" || status === "failed";
}

class ArtifactEditsController {
  async startEdit(
    tenantId: string,
    artifactId: string,
    body: any,
  ): Promise<RouteResponse> {
    if (!artifactId) {
      throw new ApiError("Artifact ID is required", 400);
    }

    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const model = typeof body?.model === "string" ? body.model.trim() : "";

    const request = await artifactEditService.createRequest({
      tenantId,
      artifactId,
      prompt,
      model,
    });

    try {
      if (env.isDevelopment()) {
        logger.info("[ArtifactEditsController] Local mode - processing edit synchronously", {
          editId: request.edit_id,
          artifactId,
        });
        const { handleArtifactEditRequest } = await import("./artifactEditHandler");
        const response = (await handleArtifactEditRequest({
          source: "artifact-edit-request",
          edit_id: request.edit_id,
        })) as { statusCode?: number };
        if ((response?.statusCode || 500) >= 400) {
          throw new Error("Artifact edit processing failed in local mode");
        }
      } else {
        const functionTarget = env.getLambdaInvokeTarget();
        await lambdaClient.send(
          new InvokeCommand({
            FunctionName: functionTarget,
            InvocationType: "Event",
            Payload: JSON.stringify({
              source: "artifact-edit-request",
              edit_id: request.edit_id,
            }),
          }),
        );
      }
    } catch (error: any) {
      logger.error("[ArtifactEditsController] Failed to start artifact edit request", {
        editId: request.edit_id,
        artifactId,
        error: error?.message || String(error),
      });

      await artifactEditService.updateRequest(request.edit_id, {
        status: "failed",
        message: "Failed to start file edit",
        error_message: error?.message || "Failed to start processing",
        updated_at: new Date().toISOString(),
      });

      throw new ApiError("Failed to start artifact edit", 500);
    }

    return {
      statusCode: 202,
      body: buildArtifactEditStatusPayload(request),
    };
  }

  async getStatus(
    tenantId: string,
    editId: string,
  ): Promise<RouteResponse> {
    if (!editId) {
      throw new ApiError("Edit ID is required", 400);
    }

    const request = await artifactEditService.getOwnedRequest(tenantId, editId);
    return {
      statusCode: 200,
      body: buildArtifactEditStatusPayload(request),
    };
  }

  async streamStatus(
    tenantId: string,
    editId: string,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    if (!editId) {
      throw new ApiError("Edit ID is required", 400);
    }

    const initialRequest = await artifactEditService.getOwnedRequest(tenantId, editId);
    const initialPayload = buildArtifactEditStatusPayload(initialRequest);
    const res = (context as RequestContext & { res?: any } | undefined)?.res;

    if (!res) {
      return {
        statusCode: 202,
        body: {
          fallback: true,
          message: "Live streaming unavailable in this runtime. Use polling instead.",
          ...initialPayload,
        },
      };
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    const sendEvent = (eventName: string, payload: Record<string, any>) => {
      if (res.writableEnded) {
        return;
      }
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const sendHeartbeat = () => {
      if (!res.writableEnded) {
        res.write(": keep-alive\n\n");
      }
    };

    sendEvent("snapshot", initialPayload);

    if (isTerminalStatus(initialPayload.status)) {
      sendEvent("complete", initialPayload);
      res.end();
      return { statusCode: 200, body: { handled: true } };
    }

    await new Promise<void>((resolve) => {
      let closed = false;
      let pollTimer: ReturnType<typeof setTimeout> | null = null;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
      let lastSerialized = JSON.stringify(initialPayload);

      const cleanup = () => {
        if (closed) {
          return;
        }
        closed = true;
        if (pollTimer) {
          clearTimeout(pollTimer);
          pollTimer = null;
        }
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        res.off?.("close", cleanup);
        res.off?.("error", onStreamError);
        resolve();
      };

      const onStreamError = (error: unknown) => {
        logger.warn("[ArtifactEditsController] Artifact edit SSE stream error", {
          editId,
          error: error instanceof Error ? error.message : String(error),
        });
        cleanup();
      };

      const endStream = () => {
        if (!res.writableEnded) {
          res.end();
        }
        cleanup();
      };

      const schedulePoll = () => {
        pollTimer = setTimeout(() => {
          void pollForUpdates();
        }, 750);
      };

      const pollForUpdates = async () => {
        if (closed || res.writableEnded) {
          cleanup();
          return;
        }

        try {
          const nextRequest = await artifactEditService.getOwnedRequest(
            tenantId,
            editId,
          );
          const nextPayload = buildArtifactEditStatusPayload(nextRequest);
          const nextSerialized = JSON.stringify(nextPayload);

          if (nextSerialized !== lastSerialized) {
            lastSerialized = nextSerialized;
            sendEvent("update", nextPayload);
          }

          if (isTerminalStatus(nextPayload.status)) {
            sendEvent("complete", nextPayload);
            endStream();
            return;
          }
        } catch (error) {
          logger.error("[ArtifactEditsController] Failed to stream artifact edit", {
            editId,
            error: error instanceof Error ? error.message : String(error),
          });
          sendEvent("error", {
            edit_id: editId,
            message:
              error instanceof Error
                ? error.message
                : "Failed to stream artifact edit updates",
          });
          endStream();
          return;
        }

        schedulePoll();
      };

      res.on?.("close", cleanup);
      res.on?.("error", onStreamError);

      heartbeatTimer = setInterval(sendHeartbeat, 15000);
      schedulePoll();
    });

    return {
      statusCode: 200,
      body: { handled: true },
    };
  }
}

export const artifactEditsController = new ArtifactEditsController();
