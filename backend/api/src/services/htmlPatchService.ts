import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { logger } from "../utils/logger";
import { env } from "../utils/env";
import { htmlPatcher, PatchOperation } from "./html/patcher";

const ARTIFACTS_BUCKET = env.artifactsBucket;
const s3Client = new S3Client({ region: env.awsRegion });

export class HtmlPatchService {
  /**
   * Patch an HTML file in S3 with a set of operations.
   */
  async patchHtmlArtifact(
    tenantId: string,
    s3Key: string,
    patches: PatchOperation[]
  ): Promise<string> {
    logger.info("Patching HTML artifact", { s3Key, patchesCount: patches.length });

    // 1. Fetch original HTML
    let originalHtml = "";
    try {
      const response = await s3Client.send(
        new GetObjectCommand({
          Bucket: ARTIFACTS_BUCKET,
          Key: s3Key,
        })
      );
      originalHtml = await response.Body?.transformToString() || "";
    } catch (error: any) {
      logger.error("Failed to fetch original HTML for patching", { error, s3Key });
      throw new Error(`Failed to fetch original HTML: ${error.message}`);
    }

    // 2. Apply patches
    const patchedHtml = htmlPatcher.applyPatches(originalHtml, patches);

    // 3. Upload patched HTML
    // We overwrite the original key for "patching" semantics, or could save as new version
    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: ARTIFACTS_BUCKET,
          Key: s3Key,
          Body: patchedHtml,
          ContentType: "text/html",
          CacheControl: "no-cache", // Important for immediate updates
        })
      );
    } catch (error: any) {
      logger.error("Failed to upload patched HTML", { error, s3Key });
      throw new Error(`Failed to upload patched HTML: ${error.message}`);
    }

    return patchedHtml;
  }
}

export const htmlPatchService = new HtmlPatchService();

