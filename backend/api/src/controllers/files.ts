import { db } from "../utils/db";
import { RouteResponse } from "../routes";
import { RequestContext } from "../routes/router";
import { getCustomerId, getActingUserId } from "../utils/rbac";
import { s3Service } from "../services/s3Service";
import {
  uploadFileToOpenAI,
  searchFilesSimple,
  deleteFileFromOpenAI,
} from "../services/openaiFileService";
import { ApiError } from "../utils/errors";
import { logger } from "../utils/logger";
import { ulid } from "ulid";
import { env } from "../utils/env";

const FILES_TABLE = env.filesTable;

/**
 * Files Controller
 * Handles file upload, listing, retrieval, deletion, and search
 */
class FilesController {
  /**
   * Upload a file
   * POST /files
   */
  async upload(
    _params: Record<string, string>,
    body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    const customerId = getCustomerId(context);

    // Validate request
    if (!body.file || !body.filename) {
      throw new ApiError("File and filename are required", 400);
    }

    // Parse file data (assuming base64 encoded or buffer)
    let fileBuffer: Buffer;
    if (typeof body.file === "string") {
      // Base64 encoded
      fileBuffer = Buffer.from(body.file, "base64");
    } else if (Buffer.isBuffer(body.file)) {
      fileBuffer = body.file;
    } else {
      throw new ApiError("Invalid file format", 400);
    }

    const filename = body.filename as string;
    const category = (body.category as string) || "uploads";
    const fileType = (body.fileType as string) || "document";
    const contentType = body.contentType || "application/octet-stream";

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (fileBuffer.length > maxSize) {
      throw new ApiError("File size exceeds maximum allowed size (10MB)", 400);
    }

    try {
      // 1. Upload to S3
      const s3Key = await s3Service.uploadFile(
        customerId,
        fileBuffer,
        filename,
        category,
        contentType,
      );

      // 2. Upload to OpenAI for indexing
      let openaiFileId: string | undefined;
      try {
        openaiFileId = await uploadFileToOpenAI(
          fileBuffer,
          filename,
          customerId,
        );
      } catch (error) {
        logger.warn(
          "[Files] Error uploading to OpenAI, continuing without indexing",
          {
            error: error instanceof Error ? error.message : String(error),
          },
        );
        // Continue without OpenAI indexing
      }

      // 3. Create file record in DynamoDB
      const fileId = `file_${ulid()}`;
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
        created_by: getActingUserId(context),
      };

      await db.put(FILES_TABLE, fileRecord);

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
    } catch (error) {
      logger.error("[Files] Error uploading file", {
        error: error instanceof Error ? error.message : String(error),
        customerId,
        filename,
      });

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError("Failed to upload file", 500);
    }
  }

  /**
   * List files for current customer
   * GET /files
   */
  async list(
    _params: Record<string, string>,
    _body: any,
    query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    const customerId = getCustomerId(context);

    const limit = parseInt(query.limit || "50", 10);
    const fileType = query.fileType;

    try {
      // Query files by customer_id
      const result = await db.query(
        FILES_TABLE,
        "gsi_customer_id",
        "customer_id = :customer_id",
        { ":customer_id": customerId },
        undefined,
        limit,
      );

      let files = result.items || [];

      // Filter by file type if specified (client-side filter since db.query doesn't support FilterExpression)
      if (fileType) {
        files = files.filter((file: any) => file.file_type === fileType);
      }

      logger.debug("[Files] Listed files", {
        customerId,
        count: files.length,
        fileType,
      });

      return {
        statusCode: 200,
        body: {
          files: files.map((file: any) => ({
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
    } catch (error) {
      logger.error("[Files] Error listing files", {
        error: error instanceof Error ? error.message : String(error),
        customerId,
      });
      throw new ApiError("Failed to list files", 500);
    }
  }

  /**
   * Get file metadata
   * GET /files/:fileId
   */
  async get(
    params: Record<string, string>,
    _body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    const customerId = getCustomerId(context);

    const fileId = params.fileId;
    if (!fileId) {
      throw new ApiError("File ID is required", 400);
    }

    try {
      const file = await db.get(FILES_TABLE, { file_id: fileId });

      if (!file) {
        throw new ApiError("File not found", 404);
      }

      // Verify customer access
      if (file.customer_id !== customerId) {
        throw new ApiError(
          "You do not have permission to access this file",
          403,
        );
      }

      // Generate presigned URL for download
      const downloadUrl = await s3Service.getFileUrl(file.s3_key);

      logger.debug("[Files] Retrieved file", {
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
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error("[Files] Error getting file", {
        error: error instanceof Error ? error.message : String(error),
        fileId,
        customerId,
      });
      throw new ApiError("Failed to get file", 500);
    }
  }

  /**
   * Delete a file
   * DELETE /files/:fileId
   */
  async delete(
    params: Record<string, string>,
    _body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    const customerId = getCustomerId(context);

    const fileId = params.fileId;
    if (!fileId) {
      throw new ApiError("File ID is required", 400);
    }

    try {
      const file = await db.get(FILES_TABLE, { file_id: fileId });

      if (!file) {
        throw new ApiError("File not found", 404);
      }

      // Verify customer access
      if (file.customer_id !== customerId) {
        throw new ApiError(
          "You do not have permission to delete this file",
          403,
        );
      }

      // Delete from S3
      await s3Service.deleteFile(file.s3_key);

      // Delete from OpenAI if indexed
      if (file.openai_file_id) {
        await deleteFileFromOpenAI(file.openai_file_id);
      }

      // Delete from DynamoDB
      await db.delete(FILES_TABLE, { file_id: fileId });

      return {
        statusCode: 200,
        body: {
          message: "File deleted successfully",
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error("[Files] Error deleting file", {
        error: error instanceof Error ? error.message : String(error),
        fileId,
        customerId,
      });
      throw new ApiError("Failed to delete file", 500);
    }
  }

  /**
   * Search files using OpenAI
   * POST /files/search
   */
  async search(
    _params: Record<string, string>,
    body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    const customerId = getCustomerId(context);

    if (!body.query || typeof body.query !== "string") {
      throw new ApiError("Query is required", 400);
    }

    const query = body.query as string;

    try {
      // Get all files for this customer
      const result = await db.query(
        FILES_TABLE,
        "gsi_customer_id",
        "customer_id = :customer_id",
        { ":customer_id": customerId },
        undefined,
        100, // Limit to 100 files for search
      );

      const files = result.items || [];
      const openaiFileIds = files
        .filter((file: any) => file.openai_file_id)
        .map((file: any) => file.openai_file_id);

      if (openaiFileIds.length === 0) {
        return {
          statusCode: 200,
          body: {
            response: "No indexed files available to search.",
            fileIds: [],
          },
        };
      }

      // Search files using OpenAI
      const searchResult = await searchFilesSimple(
        customerId,
        query,
        openaiFileIds,
      );

      return {
        statusCode: 200,
        body: {
          response: searchResult.response,
          fileIds: searchResult.fileIds,
          filesSearched: openaiFileIds.length,
        },
      };
    } catch (error) {
      logger.error("[Files] Error searching files", {
        error: error instanceof Error ? error.message : String(error),
        customerId,
        query,
      });
      throw new ApiError("Failed to search files", 500);
    }
  }
}

export const filesController = new FilesController();
