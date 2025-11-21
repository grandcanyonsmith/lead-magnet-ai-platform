"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filesController = void 0;
const db_1 = require("../utils/db");
const rbac_1 = require("../utils/rbac");
const s3Service_1 = require("../services/s3Service");
const openaiFileService_1 = require("../services/openaiFileService");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const ulid_1 = require("ulid");
const env_1 = require("../utils/env");
const FILES_TABLE = env_1.env.filesTable;
/**
 * Files Controller
 * Handles file upload, listing, retrieval, deletion, and search
 */
class FilesController {
    /**
     * Upload a file
     * POST /files
     */
    async upload(_params, body, _query, _tenantId, context) {
        const customerId = (0, rbac_1.getCustomerId)(context);
        // Validate request
        if (!body.file || !body.filename) {
            throw new errors_1.ApiError('File and filename are required', 400);
        }
        // Parse file data (assuming base64 encoded or buffer)
        let fileBuffer;
        if (typeof body.file === 'string') {
            // Base64 encoded
            fileBuffer = Buffer.from(body.file, 'base64');
        }
        else if (Buffer.isBuffer(body.file)) {
            fileBuffer = body.file;
        }
        else {
            throw new errors_1.ApiError('Invalid file format', 400);
        }
        const filename = body.filename;
        const category = body.category || 'uploads';
        const fileType = body.fileType || 'document';
        const contentType = body.contentType || 'application/octet-stream';
        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (fileBuffer.length > maxSize) {
            throw new errors_1.ApiError('File size exceeds maximum allowed size (10MB)', 400);
        }
        try {
            // 1. Upload to S3
            const s3Key = await s3Service_1.s3Service.uploadFile(customerId, fileBuffer, filename, category, contentType);
            // 2. Upload to OpenAI for indexing
            let openaiFileId;
            try {
                openaiFileId = await (0, openaiFileService_1.uploadFileToOpenAI)(fileBuffer, filename, customerId);
            }
            catch (error) {
                logger_1.logger.warn('[Files] Error uploading to OpenAI, continuing without indexing', {
                    error: error instanceof Error ? error.message : String(error),
                });
                // Continue without OpenAI indexing
            }
            // 3. Create file record in DynamoDB
            const fileId = `file_${(0, ulid_1.ulid)()}`;
            const now = new Date().toISOString();
            const fileRecord = {
                file_id: fileId,
                customer_id: customerId,
                s3_key: s3Key,
                openai_file_id: openaiFileId,
                original_filename: filename,
                file_type: fileType,
                file_size: fileBuffer.length,
                content_type: contentType,
                created_at: now,
                created_by: (0, rbac_1.getActingUserId)(context),
            };
            await db_1.db.put(FILES_TABLE, fileRecord);
            return {
                statusCode: 201,
                body: {
                    file_id: fileId,
                    customer_id: customerId,
                    s3_key: s3Key,
                    openai_file_id: openaiFileId,
                    original_filename: filename,
                    file_type: fileType,
                    file_size: fileBuffer.length,
                    content_type: contentType,
                    created_at: now,
                },
            };
        }
        catch (error) {
            logger_1.logger.error('[Files] Error uploading file', {
                error: error instanceof Error ? error.message : String(error),
                customerId,
                filename,
            });
            if (error instanceof errors_1.ApiError) {
                throw error;
            }
            throw new errors_1.ApiError('Failed to upload file', 500);
        }
    }
    /**
     * List files for current customer
     * GET /files
     */
    async list(_params, _body, query, _tenantId, context) {
        const customerId = (0, rbac_1.getCustomerId)(context);
        const limit = parseInt(query.limit || '50', 10);
        const fileType = query.fileType;
        try {
            // Query files by customer_id
            const result = await db_1.db.query(FILES_TABLE, 'gsi_customer_id', 'customer_id = :customer_id', { ':customer_id': customerId }, undefined, limit);
            let files = result.items || [];
            // Filter by file type if specified (client-side filter since db.query doesn't support FilterExpression)
            if (fileType) {
                files = files.filter((file) => file.file_type === fileType);
            }
            logger_1.logger.debug('[Files] Listed files', {
                customerId,
                count: files.length,
                fileType,
            });
            return {
                statusCode: 200,
                body: {
                    files: files.map((file) => ({
                        file_id: file.file_id,
                        original_filename: file.original_filename,
                        file_type: file.file_type,
                        file_size: file.file_size,
                        content_type: file.content_type,
                        created_at: file.created_at,
                    })),
                    count: files.length,
                },
            };
        }
        catch (error) {
            logger_1.logger.error('[Files] Error listing files', {
                error: error instanceof Error ? error.message : String(error),
                customerId,
            });
            throw new errors_1.ApiError('Failed to list files', 500);
        }
    }
    /**
     * Get file metadata
     * GET /files/:fileId
     */
    async get(params, _body, _query, _tenantId, context) {
        const customerId = (0, rbac_1.getCustomerId)(context);
        const fileId = params.fileId;
        if (!fileId) {
            throw new errors_1.ApiError('File ID is required', 400);
        }
        try {
            const file = await db_1.db.get(FILES_TABLE, { file_id: fileId });
            if (!file) {
                throw new errors_1.ApiError('File not found', 404);
            }
            // Verify customer access
            if (file.customer_id !== customerId) {
                throw new errors_1.ApiError('You do not have permission to access this file', 403);
            }
            // Generate presigned URL for download
            const downloadUrl = await s3Service_1.s3Service.getFileUrl(file.s3_key);
            logger_1.logger.debug('[Files] Retrieved file', {
                fileId,
                customerId,
            });
            return {
                statusCode: 200,
                body: {
                    file_id: file.file_id,
                    customer_id: file.customer_id,
                    original_filename: file.original_filename,
                    file_type: file.file_type,
                    file_size: file.file_size,
                    content_type: file.content_type,
                    created_at: file.created_at,
                    download_url: downloadUrl,
                },
            };
        }
        catch (error) {
            if (error instanceof errors_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('[Files] Error getting file', {
                error: error instanceof Error ? error.message : String(error),
                fileId,
                customerId,
            });
            throw new errors_1.ApiError('Failed to get file', 500);
        }
    }
    /**
     * Delete a file
     * DELETE /files/:fileId
     */
    async delete(params, _body, _query, _tenantId, context) {
        const customerId = (0, rbac_1.getCustomerId)(context);
        const fileId = params.fileId;
        if (!fileId) {
            throw new errors_1.ApiError('File ID is required', 400);
        }
        try {
            const file = await db_1.db.get(FILES_TABLE, { file_id: fileId });
            if (!file) {
                throw new errors_1.ApiError('File not found', 404);
            }
            // Verify customer access
            if (file.customer_id !== customerId) {
                throw new errors_1.ApiError('You do not have permission to delete this file', 403);
            }
            // Delete from S3
            await s3Service_1.s3Service.deleteFile(file.s3_key);
            // Delete from OpenAI if indexed
            if (file.openai_file_id) {
                await (0, openaiFileService_1.deleteFileFromOpenAI)(file.openai_file_id);
            }
            // Delete from DynamoDB
            await db_1.db.delete(FILES_TABLE, { file_id: fileId });
            return {
                statusCode: 200,
                body: {
                    message: 'File deleted successfully',
                },
            };
        }
        catch (error) {
            if (error instanceof errors_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('[Files] Error deleting file', {
                error: error instanceof Error ? error.message : String(error),
                fileId,
                customerId,
            });
            throw new errors_1.ApiError('Failed to delete file', 500);
        }
    }
    /**
     * Search files using OpenAI
     * POST /files/search
     */
    async search(_params, body, _query, _tenantId, context) {
        const customerId = (0, rbac_1.getCustomerId)(context);
        if (!body.query || typeof body.query !== 'string') {
            throw new errors_1.ApiError('Query is required', 400);
        }
        const query = body.query;
        try {
            // Get all files for this customer
            const result = await db_1.db.query(FILES_TABLE, 'gsi_customer_id', 'customer_id = :customer_id', { ':customer_id': customerId }, undefined, 100 // Limit to 100 files for search
            );
            const files = result.items || [];
            const openaiFileIds = files
                .filter((file) => file.openai_file_id)
                .map((file) => file.openai_file_id);
            if (openaiFileIds.length === 0) {
                return {
                    statusCode: 200,
                    body: {
                        response: 'No indexed files available to search.',
                        fileIds: [],
                    },
                };
            }
            // Search files using OpenAI
            const searchResult = await (0, openaiFileService_1.searchFilesSimple)(customerId, query, openaiFileIds);
            return {
                statusCode: 200,
                body: {
                    response: searchResult.response,
                    fileIds: searchResult.fileIds,
                    filesSearched: openaiFileIds.length,
                },
            };
        }
        catch (error) {
            logger_1.logger.error('[Files] Error searching files', {
                error: error instanceof Error ? error.message : String(error),
                customerId,
                query,
            });
            throw new errors_1.ApiError('Failed to search files', 500);
        }
    }
}
exports.filesController = new FilesController();
//# sourceMappingURL=files.js.map