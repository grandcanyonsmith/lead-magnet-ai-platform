export declare class ArtifactUrlService {
    /**
     * Check if a URL is a presigned S3 URL (contains X-Amz- query parameters)
     */
    static isPresignedUrl(url: string | null | undefined): boolean;
    /**
     * Check if a URL is a direct S3 public URL (bucket.s3.region.amazonaws.com)
     */
    static isDirectS3Url(url: string | null | undefined): boolean;
    /**
     * Check if an artifact is an image based on file extension or content type
     */
    static isImage(artifact: any): boolean;
    /**
     * Generate a direct S3 public URL for an S3 key
     */
    static getDirectS3Url(s3Key: string): string;
    /**
     * Generate a CloudFront URL for an S3 key
     */
    static getCloudFrontUrl(s3Key: string): string;
    /**
     * Generate a presigned URL as fallback when CloudFront is not available
     * Note: Maximum expiration is 7 days (604800 seconds) per AWS limits
     * CloudFront URLs should be preferred as they don't expire
     */
    static generatePresignedUrl(s3Key: string, expiresIn?: number): Promise<{
        url: string;
        expiresAt: string;
    }>;
    /**
     * Check if artifact needs URL refresh
     */
    static needsUrlRefresh(artifact: any): boolean;
    /**
     * Generate URL for an artifact
     * For images: direct S3 public URL (permanent, non-expiring)
     * For other artifacts: CloudFront preferred, presigned as fallback
     */
    static generateUrl(s3Key: string, artifact?: any): Promise<{
        url: string;
        expiresAt: string | null;
    }>;
    /**
     * Refresh URL for an artifact and update it in the database
     */
    static refreshUrl(artifact: any): Promise<{
        url: string;
        expiresAt: string | null;
    }>;
    /**
     * Ensure artifact has a valid URL (refresh if needed)
     */
    static ensureValidUrl(artifact: any): Promise<string>;
}
//# sourceMappingURL=artifactUrlService.d.ts.map