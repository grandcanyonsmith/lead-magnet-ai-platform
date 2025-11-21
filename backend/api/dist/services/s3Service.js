"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.s3Service = exports.S3Service = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
const env_1 = require("../utils/env");
const s3Client = new client_s3_1.S3Client({ region: env_1.env.awsRegion });
const BUCKET_NAME = env_1.env.artifactsBucket;
if (!BUCKET_NAME) {
    logger_1.logger.warn('[S3Service] ARTIFACTS_BUCKET not set - file operations will fail');
}
/**
 * S3 Service for customer-scoped file operations
 */
class S3Service {
    /**
     * Upload a file to S3 with customer-scoped path
     * @param customerId - Customer ID (always derived server-side)
     * @param fileBuffer - File buffer
     * @param filename - Original filename
     * @param category - Optional category (e.g., 'invoices', 'contracts', 'documents')
     * @param contentType - MIME type
     * @returns S3 key
     */
    async uploadFile(customerId, fileBuffer, filename, category = 'uploads', contentType = 'application/octet-stream') {
        if (!BUCKET_NAME) {
            throw new errors_1.ApiError('S3 bucket not configured', 500);
        }
        // Sanitize filename to prevent path traversal
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        // Generate unique filename with timestamp
        const timestamp = Date.now();
        const uniqueFilename = `${timestamp}_${sanitizedFilename}`;
        // Construct S3 key: customers/{customerId}/{category}/{filename}
        const s3Key = `customers/${customerId}/${category}/${uniqueFilename}`;
        try {
            await s3Client.send(new client_s3_1.PutObjectCommand({
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
            }));
            logger_1.logger.info('[S3Service] File uploaded', {
                s3Key,
                customerId,
                filename,
                category,
                size: fileBuffer.length,
            });
            return s3Key;
        }
        catch (error) {
            logger_1.logger.error('[S3Service] Error uploading file', {
                error: error instanceof Error ? error.message : String(error),
                s3Key,
                customerId,
            });
            throw new errors_1.ApiError('Failed to upload file', 500);
        }
    }
    /**
     * Get a presigned URL for file download
     * @param s3Key - S3 object key
     * @param expiresIn - URL expiration time in seconds (default: 1 hour)
     * @returns Presigned URL
     */
    async getFileUrl(s3Key, expiresIn = 3600) {
        if (!BUCKET_NAME) {
            throw new errors_1.ApiError('S3 bucket not configured', 500);
        }
        try {
            const command = new client_s3_1.GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: s3Key,
            });
            const url = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn });
            logger_1.logger.debug('[S3Service] Generated presigned URL', {
                s3Key,
                expiresIn,
            });
            return url;
        }
        catch (error) {
            logger_1.logger.error('[S3Service] Error generating presigned URL', {
                error: error instanceof Error ? error.message : String(error),
                s3Key,
            });
            throw new errors_1.ApiError('Failed to generate file URL', 500);
        }
    }
    /**
     * Get file content directly (for small files)
     * @param s3Key - S3 object key
     * @returns File buffer and content type
     */
    async getFile(s3Key) {
        if (!BUCKET_NAME) {
            throw new errors_1.ApiError('S3 bucket not configured', 500);
        }
        try {
            const command = new client_s3_1.GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: s3Key,
            });
            const response = await s3Client.send(command);
            if (!response.Body) {
                throw new errors_1.ApiError('File not found', 404);
            }
            // Convert stream to buffer
            const chunks = [];
            for await (const chunk of response.Body) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            const contentType = response.ContentType || 'application/octet-stream';
            logger_1.logger.debug('[S3Service] Retrieved file', {
                s3Key,
                size: buffer.length,
                contentType,
            });
            return { buffer, contentType };
        }
        catch (error) {
            if (error instanceof errors_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('[S3Service] Error retrieving file', {
                error: error instanceof Error ? error.message : String(error),
                s3Key,
            });
            throw new errors_1.ApiError('Failed to retrieve file', 500);
        }
    }
    /**
     * Delete a file from S3
     * @param s3Key - S3 object key
     */
    async deleteFile(s3Key) {
        if (!BUCKET_NAME) {
            throw new errors_1.ApiError('S3 bucket not configured', 500);
        }
        try {
            await s3Client.send(new client_s3_1.DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: s3Key,
            }));
            logger_1.logger.info('[S3Service] File deleted', {
                s3Key,
            });
        }
        catch (error) {
            logger_1.logger.error('[S3Service] Error deleting file', {
                error: error instanceof Error ? error.message : String(error),
                s3Key,
            });
            throw new errors_1.ApiError('Failed to delete file', 500);
        }
    }
    /**
     * Validate that an S3 key belongs to a customer (security check)
     * @param s3Key - S3 object key
     * @param customerId - Expected customer ID
     * @returns true if key belongs to customer
     */
    validateCustomerKey(s3Key, customerId) {
        const expectedPrefix = `customers/${customerId}/`;
        return s3Key.startsWith(expectedPrefix);
    }
}
exports.S3Service = S3Service;
// Export singleton instance
exports.s3Service = new S3Service();
//# sourceMappingURL=s3Service.js.map