import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { db } from '../utils/db';

const ARTIFACTS_TABLE = process.env.ARTIFACTS_TABLE;
const ARTIFACTS_BUCKET = process.env.ARTIFACTS_BUCKET;
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN?.trim() || '';

if (!ARTIFACTS_TABLE) {
  console.error('[ArtifactUrlService] ARTIFACTS_TABLE environment variable is not set');
}
if (!ARTIFACTS_BUCKET) {
  console.error('[ArtifactUrlService] ARTIFACTS_BUCKET environment variable is not set');
}

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

export class ArtifactUrlService {
  /**
   * Check if a URL is a presigned S3 URL (contains X-Amz- query parameters)
   */
  static isPresignedUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.has('X-Amz-Algorithm') || urlObj.searchParams.has('X-Amz-Signature');
    } catch {
      return false;
    }
  }

  /**
   * Generate a CloudFront URL for an S3 key
   */
  static getCloudFrontUrl(s3Key: string): string {
    if (!CLOUDFRONT_DOMAIN) {
      throw new Error('CLOUDFRONT_DOMAIN is not configured');
    }
    return `https://${CLOUDFRONT_DOMAIN}/${s3Key}`;
  }

  /**
   * Generate a presigned URL as fallback when CloudFront is not available
   * Note: Maximum expiration is 7 days (604800 seconds) per AWS limits
   * CloudFront URLs should be preferred as they don't expire
   */
  static async generatePresignedUrl(s3Key: string, expiresIn: number = 604800): Promise<{ url: string; expiresAt: string }> {
    if (!ARTIFACTS_BUCKET) {
      throw new Error('ARTIFACTS_BUCKET is not configured');
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

    // Check if artifact already has a valid CloudFront URL
    const hasValidCloudFrontUrl = artifact.public_url && 
      !this.isPresignedUrl(artifact.public_url) &&
      artifact.public_url.startsWith('https://');
    
    // Check if artifact has expired presigned URL or needs replacement
    const hasExpiredPresignedUrl = this.isPresignedUrl(artifact.public_url) &&
      (artifact.url_expires_at && new Date(artifact.url_expires_at) < new Date());
    
    return !artifact.public_url || hasExpiredPresignedUrl || this.isPresignedUrl(artifact.public_url) || !hasValidCloudFrontUrl;
  }

  /**
   * Generate URL for an artifact (CloudFront preferred, presigned as fallback)
   */
  static async generateUrl(s3Key: string): Promise<{ url: string; expiresAt: string | null }> {
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
  static async refreshUrl(artifact: any): Promise<{ url: string; expiresAt: string | null }> {
    if (!ARTIFACTS_TABLE) {
      throw new Error('ARTIFACTS_TABLE is not configured');
    }

    if (!artifact.s3_key) {
      return {
        url: artifact.public_url || '',
        expiresAt: artifact.url_expires_at || null,
      };
    }

    const { url, expiresAt } = await this.generateUrl(artifact.s3_key);

    // Update artifact in database with new URL
    const updateData: any = {
      public_url: url,
    };
    if (expiresAt) {
      updateData.url_expires_at = expiresAt;
    } else {
      updateData.url_expires_at = null; // Clear expiration for CloudFront URLs
    }

    await db.update(ARTIFACTS_TABLE!, { artifact_id: artifact.artifact_id }, updateData);

    return { url, expiresAt };
  }

  /**
   * Ensure artifact has a valid URL (refresh if needed)
   */
  static async ensureValidUrl(artifact: any): Promise<string> {
    if (!artifact.s3_key) {
      return artifact.public_url || '';
    }

    if (this.needsUrlRefresh(artifact)) {
      const { url } = await this.refreshUrl(artifact);
      return url;
    }

    return artifact.public_url || '';
  }
}

