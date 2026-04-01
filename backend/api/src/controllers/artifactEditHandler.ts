import { APIGatewayProxyResultV2 } from "aws-lambda";
import { artifactEditService } from "../services/artifactEditService";
import { logger } from "../utils/logger";

export async function handleArtifactEditRequest(
  event: any,
): Promise<APIGatewayProxyResultV2> {
  const editId = event?.edit_id;

  if (!editId) {
    logger.error("[ArtifactEditHandler] Missing edit_id", { event });
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing edit_id" }),
    };
  }

  try {
    await artifactEditService.processRequest(editId);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, edit_id: editId }),
    };
  } catch (error: any) {
    logger.error("[ArtifactEditHandler] Artifact edit failed", {
      editId,
      error: error?.message || String(error),
      stack: error?.stack,
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error?.message || "Artifact edit processing failed",
      }),
    };
  }
}
