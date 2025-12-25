import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "../utils/db";
import { env } from "../utils/env";
import { logger } from "../utils/logger";

const ARTIFACTS_TABLE = env.artifactsTable;
const ARTIFACTS_BUCKET = env.artifactsBucket;
const CLOUDFRONT_DOMAIN = env.cloudfrontDomain;

if (!ARTIFACTS_TABLE) {
  logger.error(
    "[ArtifactUrlService] ARTIFACTS_TABLE environment variable is not set",
  );
}
if (!ARTIFACTS_BUCKET) {
  logger.error(
    "[ArtifactUrlService] ARTIFACTS_BUCKET environment variable is not set",
  );
}

const s3Client = new S3Client({ region: env.awsRegion });
const AWS_REGION = env.awsRegion;

export class ArtifactUrlService {
  /**
   * Check if a URL is a presigned S3 URL (contains X-Amz- query parameters)
   */
  static isPresignedUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    try {
      const urlObj = new URL(url);
      return (
        urlObj.searchParams.has("X-Amz-Algorithm") ||
        urlObj.searchParams.has("X-Amz-Signature")
      );
    } catch {
      return false;
    }
  }

  /**
   * Check if a URL is a direct S3 public URL (bucket.s3.region.amazonaws.com)
   */
  static isDirectS3Url(url: string | null | undefined): boolean {
    if (!url) return false;
    return (
      url.includes(".s3.") &&
      url.includes(".amazonaws.com/") &&
      !this.isPresignedUrl(url)
    );
  }

  /**
   * Check if an artifact is an image based on file extension or content type
   */
  static isImage(artifact: any): boolean {
    const fileName = artifact.artifact_name || artifact.file_name || "";
    const contentType = artifact.mime_type || artifact.content_type || "";
    const artifactType = artifact.artifact_type || "";

    const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];
    const imageContentTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ];

    return (
      artifactType === "image" ||
      imageExtensions.some((ext) => fileName.toLowerCase().endsWith(ext)) ||
      imageContentTypes.some((type) => contentType.toLowerCase().includes(type))
    );
  }

  /**
   * Generate a direct S3 public URL for an S3 key
   */
  static getDirectS3Url(s3Key: string): string {
    if (!ARTIFACTS_BUCKET) {
      throw new Error("ARTIFACTS_BUCKET is not configured");
    }
    return `https://${ARTIFACTS_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
  }

  /**
   * Generate a CloudFront URL for an S3 key
   */
  static getCloudFrontUrl(s3Key: string): string {
    if (!CLOUDFRONT_DOMAIN) {
      throw new Error("CLOUDFRONT_DOMAIN is not configured");
    }
    return `https://${CLOUDFRONT_DOMAIN}/${s3Key}`;
  }

  /**
   * Generate a presigned URL as fallback when CloudFront is not available
   * Note: Maximum expiration is 7 days (604800 seconds) per AWS limits
   * CloudFront URLs should be preferred as they don't expire
   */
  static async generatePresignedUrl(
    s3Key: string,
    expiresIn: number = 604800,
  ): Promise<{ url: string; expiresAt: string }> {
    if (!ARTIFACTS_BUCKET) {
      throw new Error("ARTIFACTS_BUCKET is not configured");
    }

    const command = new GetObjectCommand({
      Bucket: ARTIFACTS_BUCKET,
      Key: s3Key,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return { url: presignedUrl, expiresAt };
  }

  /**
   * Check if artifact needs URL refresh
   */
  static needsUrlRefresh(artifact: any): boolean {
    if (!artifact.s3_key) return false;

    // For images, check if URL is a direct S3 URL (permanent, public)
    if (this.isImage(artifact)) {
      const hasValidDirectS3Url =
        artifact.public_url && this.isDirectS3Url(artifact.public_url);
      return (
        !artifact.public_url ||
        !hasValidDirectS3Url ||
        this.isPresignedUrl(artifact.public_url)
      );
    }

    // For non-images, check if artifact already has a valid CloudFront URL
    const hasValidCloudFrontUrl =
      artifact.public_url &&
      !this.isPresignedUrl(artifact.public_url) &&
      artifact.public_url.startsWith("https://");

    // Check if artifact has expired presigned URL or needs replacement
    const hasExpiredPresignedUrl =
      this.isPresignedUrl(artifact.public_url) &&
      artifact.url_expires_at &&
      new Date(artifact.url_expires_at) < new Date();

    return (
      !artifact.public_url ||
      hasExpiredPresignedUrl ||
      this.isPresignedUrl(artifact.public_url) ||
      !hasValidCloudFrontUrl
    );
  }

  /**
   * Generate URL for an artifact
   * For images: direct S3 public URL (permanent, non-expiring)
   * For other artifacts: CloudFront preferred, presigned as fallback
   */
  static async generateUrl(
    s3Key: string,
    artifact?: any,
  ): Promise<{ url: string; expiresAt: string | null }> {
    // For images, always use direct S3 public URL (permanent, non-expiring, publicly accessible)
    if (artifact && this.isImage(artifact)) {
      return {
        url: this.getDirectS3Url(s3Key),
        expiresAt: null,
      };
    }

    // For non-images, use CloudFront if available
    if (CLOUDFRONT_DOMAIN) {
      // Use CloudFront URL (non-expiring)
      return {
        url: this.getCloudFrontUrl(s3Key),
        expiresAt: null,
      };
    } else {
      // Fallback to presigned URL if CloudFront is not configured
      const { url, expiresAt } = await this.generatePresignedUrl(s3Key);
      return { url, expiresAt };
    }
  }

  /**
   * Refresh URL for an artifact and update it in the database
   */
  static async refreshUrl(
    artifact: any,
  ): Promise<{ url: string; expiresAt: string | null }> {
    if (!ARTIFACTS_TABLE) {
      throw new Error("ARTIFACTS_TABLE is not configured");
    }

    if (!artifact.s3_key) {
      return {
        url: artifact.public_url || "",
        expiresAt: artifact.url_expires_at || null,
      };
    }

    const { url, expiresAt } = await this.generateUrl(
      artifact.s3_key,
      artifact,
    );

    // Update artifact in database with new URL
    const updateData: any = {
      public_url: url,
    };
    if (expiresAt) {
      updateData.url_expires_at = expiresAt;
    } else {
      updateData.url_expires_at = null; // Clear expiration for CloudFront URLs
    }

    await db.update(
      ARTIFACTS_TABLE!,
      { artifact_id: artifact.artifact_id },
      updateData,
    );

    return { url, expiresAt };
  }

  /**
   * Ensure artifact has a valid URL (refresh if needed)
   */
  static async ensureValidUrl(artifact: any): Promise<string> {
    if (!artifact.s3_key) {
      return artifact.public_url || "";
    }

    if (this.needsUrlRefresh(artifact)) {
      const { url } = await this.refreshUrl(artifact);
      return url;
    }

    return artifact.public_url || "";
  }
}
