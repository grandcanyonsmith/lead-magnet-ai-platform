import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, GetObjectCommandOutput } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/errors';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.ARTIFACTS_BUCKET;

if (!BUCKET_NAME) {
  logger.warn('[S3Service] ARTIFACTS_BUCKET not set - file operations will fail');
}

/**
 * S3 Service for customer-scoped file operations
 */
export class S3Service {
  /**
   * Upload a file to S3 with customer-scoped path
   * @param customerId - Customer ID (always derived server-side)
   * @param fileBuffer - File buffer
   * @param filename - Original filename
   * @param category - Optional category (e.g., 'invoices', 'contracts', 'documents')
   * @param contentType - MIME type
   * @returns S3 key
   */
  async uploadFile(
    customerId: string,
    fileBuffer: Buffer,
    filename: string,
    category: string = 'uploads',
    contentType: string = 'application/octet-stream'
  ): Promise<string> {
    if (!BUCKET_NAME) {
      throw new ApiError('S3 bucket not configured', 500);
    }

    // Sanitize filename to prevent path traversal
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const uniqueFilename = `${timestamp}_${sanitizedFilename}`;
    
    // Construct S3 key: customers/{customerId}/{category}/{filename}
    const s3Key = `customers/${customerId}/${category}/${uniqueFilename}`;

    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
          Body: fileBuffer,
          ContentType: contentType,
          // Metadata for tracking
          Metadata: {
            customerId,
            originalFilename: filename,
            category,
            uploadedAt: new Date().toISOString(),
          },
        })
      );

      logger.info('[S3Service] File uploaded', {
        s3Key,
        customerId,
        filename,
        category,
        size: fileBuffer.length,
      });

      return s3Key;
    } catch (error) {
      logger.error('[S3Service] Error uploading file', {
        error: error instanceof Error ? error.message : String(error),
        s3Key,
        customerId,
      });
      throw new ApiError('Failed to upload file', 500);
    }
  }

  /**
   * Get a presigned URL for file download
   * @param s3Key - S3 object key
   * @param expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns Presigned URL
   */
  async getFileUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
    if (!BUCKET_NAME) {
      throw new ApiError('S3 bucket not configured', 500);
    }

    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn });

      logger.debug('[S3Service] Generated presigned URL', {
        s3Key,
        expiresIn,
      });

      return url;
    } catch (error) {
      logger.error('[S3Service] Error generating presigned URL', {
        error: error instanceof Error ? error.message : String(error),
        s3Key,
      });
      throw new ApiError('Failed to generate file URL', 500);
    }
  }

  /**
   * Get file content directly (for small files)
   * @param s3Key - S3 object key
   * @returns File buffer and content type
   */
  async getFile(s3Key: string): Promise<{ buffer: Buffer; contentType: string }> {
    if (!BUCKET_NAME) {
      throw new ApiError('S3 bucket not configured', 500);
    }

    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
      });

      const response: GetObjectCommandOutput = await s3Client.send(command);

      if (!response.Body) {
        throw new ApiError('File not found', 404);
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const contentType = response.ContentType || 'application/octet-stream';

      logger.debug('[S3Service] Retrieved file', {
        s3Key,
        size: buffer.length,
        contentType,
      });

      return { buffer, contentType };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('[S3Service] Error retrieving file', {
        error: error instanceof Error ? error.message : String(error),
        s3Key,
      });
      throw new ApiError('Failed to retrieve file', 500);
    }
  }

  /**
   * Delete a file from S3
   * @param s3Key - S3 object key
   */
  async deleteFile(s3Key: string): Promise<void> {
    if (!BUCKET_NAME) {
      throw new ApiError('S3 bucket not configured', 500);
    }

    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
        })
      );

      logger.info('[S3Service] File deleted', {
        s3Key,
      });
    } catch (error) {
      logger.error('[S3Service] Error deleting file', {
        error: error instanceof Error ? error.message : String(error),
        s3Key,
      });
      throw new ApiError('Failed to delete file', 500);
    }
  }

  /**
   * Validate that an S3 key belongs to a customer (security check)
   * @param s3Key - S3 object key
   * @param customerId - Expected customer ID
   * @returns true if key belongs to customer
   */
  validateCustomerKey(s3Key: string, customerId: string): boolean {
    const expectedPrefix = `customers/${customerId}/`;
    return s3Key.startsWith(expectedPrefix);
  }
}

// Export singleton instance
export const s3Service = new S3Service();

