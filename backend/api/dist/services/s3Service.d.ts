/**
 * S3 Service for customer-scoped file operations
 */
export declare class S3Service {
    /**
     * Upload a file to S3 with customer-scoped path
     * @param customerId - Customer ID (always derived server-side)
     * @param fileBuffer - File buffer
     * @param filename - Original filename
     * @param category - Optional category (e.g., 'invoices', 'contracts', 'documents')
     * @param contentType - MIME type
     * @returns S3 key
     */
    uploadFile(customerId: string, fileBuffer: Buffer, filename: string, category?: string, contentType?: string): Promise<string>;
    /**
     * Get a presigned URL for file download
     * @param s3Key - S3 object key
     * @param expiresIn - URL expiration time in seconds (default: 1 hour)
     * @returns Presigned URL
     */
    getFileUrl(s3Key: string, expiresIn?: number): Promise<string>;
    /**
     * Get file content directly (for small files)
     * @param s3Key - S3 object key
     * @returns File buffer and content type
     */
    getFile(s3Key: string): Promise<{
        buffer: Buffer;
        contentType: string;
    }>;
    /**
     * Delete a file from S3
     * @param s3Key - S3 object key
     */
    deleteFile(s3Key: string): Promise<void>;
    /**
     * Validate that an S3 key belongs to a customer (security check)
     * @param s3Key - S3 object key
     * @param customerId - Expected customer ID
     * @returns true if key belongs to customer
     */
    validateCustomerKey(s3Key: string, customerId: string): boolean;
}
export declare const s3Service: S3Service;
//# sourceMappingURL=s3Service.d.ts.map