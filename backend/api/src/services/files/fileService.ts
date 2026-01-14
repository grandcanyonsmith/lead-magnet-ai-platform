import { db } from "../../utils/db";
import { s3Service } from "../s3Service";
import {
  uploadFileToOpenAI,
  searchFilesSimple,
  deleteFileFromOpenAI,
} from "../openaiFileService";
import { ApiError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { ulid } from "ulid";
import { env } from "../../utils/env";

const FILES_TABLE = env.filesTable;

export interface FileRecord {
  file_id: string;
  customer_id: string;
  s3_key: string;
  openai_file_id?: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  content_type: string;
  created_at: string;
  created_by?: string;
}

export class FileService {
  private inferContentTypeFromFilename(filename: string): string | undefined {
    const lower = String(filename || "").toLowerCase();
    const ext = lower.includes(".") ? lower.split(".").pop() || "" : "";

    const map: Record<string, string> = {
      json: "application/json",
      csv: "text/csv",
      txt: "text/plain",
      md: "text/markdown",
      html: "text/html",
      htm: "text/html",
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
    };

    return map[ext];
  }

  async uploadFile(
    customerId: string,
    fileBuffer: Buffer,
    filename: string,
    options: {
      category?: string;
      fileType?: string;
      contentType?: string;
      userId?: string;
    } = {},
  ): Promise<FileRecord> {
    const category = options.category || "uploads";
    const fileType = options.fileType || "document";
    const providedContentType =
      typeof options.contentType === "string" ? options.contentType.trim() : "";
    const inferredContentType = this.inferContentTypeFromFilename(filename);
    const contentType =
      providedContentType && providedContentType !== "application/octet-stream"
        ? providedContentType
        : inferredContentType || "application/octet-stream";


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
          "[FileService] Error uploading to OpenAI, continuing without indexing",
          {
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }

      // 3. Create file record in DynamoDB
      const fileId = `file_${ulid()}`;
      const now = new Date().toISOString();

      const fileRecord: FileRecord = {
        file_id: fileId,
        customer_id: customerId,
        s3_key: s3Key,
        openai_file_id: openaiFileId,
        original_filename: filename,
        file_type: fileType,
        file_size: fileBuffer.length,
        content_type: contentType,
        created_at: now,
        created_by: options.userId,
      };

      await db.put(FILES_TABLE, fileRecord);

      return fileRecord;
    } catch (error) {
      logger.error("[FileService] Error uploading file", {
        error: error instanceof Error ? error.message : String(error),
        customerId,
        filename,
      });

      if (error instanceof ApiError) throw error;
      throw new ApiError("Failed to upload file", 500);
    }
  }

  async listFiles(
    customerId: string,
    options: { limit?: number; fileType?: string } = {},
  ): Promise<FileRecord[]> {
    const limit = options.limit || 50;

    try {
      const result = await db.query(
        FILES_TABLE,
        "gsi_customer_id",
        "customer_id = :customer_id",
        { ":customer_id": customerId },
        undefined,
        limit,
      );

      let files = result.items || [];

      if (options.fileType) {
        files = files.filter((file: any) => file.file_type === options.fileType);
      }

      return files as FileRecord[];
    } catch (error) {
      logger.error("[FileService] Error listing files", {
        error: error instanceof Error ? error.message : String(error),
        customerId,
      });
      throw new ApiError("Failed to list files", 500);
    }
  }

  async getFile(customerId: string, fileId: string): Promise<{ file: FileRecord; downloadUrl: string }> {
    try {
      const file = await db.get(FILES_TABLE, { file_id: fileId });

      if (!file) {
        throw new ApiError("File not found", 404);
      }

      if (file.customer_id !== customerId) {
        throw new ApiError("You do not have permission to access this file", 403);
      }

      const downloadUrl = await s3Service.getFileUrl(file.s3_key);

      return { file: file as FileRecord, downloadUrl };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error("[FileService] Error getting file", {
        error: error instanceof Error ? error.message : String(error),
        fileId,
        customerId,
      });
      throw new ApiError("Failed to get file", 500);
    }
  }

  async deleteFile(customerId: string, fileId: string): Promise<void> {
    try {
      const file = await db.get(FILES_TABLE, { file_id: fileId });

      if (!file) {
        throw new ApiError("File not found", 404);
      }

      if (file.customer_id !== customerId) {
        throw new ApiError("You do not have permission to delete this file", 403);
      }

      await s3Service.deleteFile(file.s3_key);

      if (file.openai_file_id) {
        await deleteFileFromOpenAI(file.openai_file_id);
      }

      await db.delete(FILES_TABLE, { file_id: fileId });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error("[FileService] Error deleting file", {
        error: error instanceof Error ? error.message : String(error),
        fileId,
        customerId,
      });
      throw new ApiError("Failed to delete file", 500);
    }
  }

  async searchFiles(customerId: string, query: string): Promise<any> {
    try {
      const result = await db.query(
        FILES_TABLE,
        "gsi_customer_id",
        "customer_id = :customer_id",
        { ":customer_id": customerId },
        undefined,
        100,
      );

      const files = result.items || [];
      const openaiFileIds = files
        .filter((file: any) => file.openai_file_id)
        .map((file: any) => file.openai_file_id);

      if (openaiFileIds.length === 0) {
        return {
          response: "No indexed files available to search.",
          fileIds: [],
          filesSearched: 0,
        };
      }

      const searchResult = await searchFilesSimple(
        customerId,
        query,
        openaiFileIds,
      );

      return {
        response: searchResult.response,
        fileIds: searchResult.fileIds,
        filesSearched: openaiFileIds.length,
      };
    } catch (error) {
      logger.error("[FileService] Error searching files", {
        error: error instanceof Error ? error.message : String(error),
        customerId,
        query,
      });
      throw new ApiError("Failed to search files", 500);
    }
  }
}

export const fileService = new FileService();
