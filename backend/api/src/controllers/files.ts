import { RouteResponse } from "../routes";
import { RequestContext } from "../routes/router";
import { getCustomerId, getActingUserId } from "../utils/rbac";
import { ApiError } from "../utils/errors";
import { fileService } from "../services/files/fileService";

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

    if (!body.file || !body.filename) {
      throw new ApiError("File and filename are required", 400);
    }

    let fileBuffer: Buffer;
    if (typeof body.file === "string") {
      fileBuffer = Buffer.from(body.file, "base64");
    } else if (Buffer.isBuffer(body.file)) {
      fileBuffer = body.file;
    } else {
      throw new ApiError("Invalid file format", 400);
    }

    const fileRecord = await fileService.uploadFile(
      customerId,
      fileBuffer,
      body.filename,
      {
        category: body.category,
        fileType: body.fileType,
        contentType: body.contentType,
        userId: getActingUserId(context),
      },
    );

    return {
      statusCode: 201,
      body: fileRecord,
    };
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

    const files = await fileService.listFiles(customerId, {
      limit,
      fileType: query.fileType,
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

    const { file, downloadUrl } = await fileService.getFile(customerId, fileId);

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

    await fileService.deleteFile(customerId, fileId);

    return {
      statusCode: 200,
      body: {
        message: "File deleted successfully",
      },
    };
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

    const searchResult = await fileService.searchFiles(customerId, body.query);

    return {
      statusCode: 200,
      body: searchResult,
    };
  }
}

export const filesController = new FilesController();
