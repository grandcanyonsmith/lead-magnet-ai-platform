import { RouteResponse } from "../routes";
import { RequestContext } from "../routes/router";
import { getCustomerId } from "../utils/rbac";
import { logger } from "../utils/logger";
import {
  ApiError,
  InternalServerError,
  ValidationError,
} from "../utils/errors";
import { folderService } from "../services/folders/folderService";

class FoldersController {
  async list(
    _params: Record<string, string>,
    _body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    try {
      const customerId = getCustomerId(context);
      const tenantId = customerId;

      logger.debug("[FoldersController.list] Listing folders", { tenantId });

      const folders = await folderService.listFolders(tenantId);

      return {
        statusCode: 200,
        body: {
          folders,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error("[FoldersController.list] Error", { error });
      throw new InternalServerError("Failed to list folders");
    }
  }

  async get(
    params: Record<string, string>,
    _body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    try {
      const customerId = getCustomerId(context);
      const tenantId = customerId;
      const folderId = params.id;

      logger.debug("[FoldersController.get] Getting folder", {
        tenantId,
        folderId,
      });

      const folder = await folderService.getFolder(tenantId, folderId);

      return {
        statusCode: 200,
        body: folder,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error("[FoldersController.get] Error", { error });
      throw new InternalServerError("Failed to get folder");
    }
  }

  async create(
    _params: Record<string, string>,
    body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    try {
      const customerId = getCustomerId(context);
      const tenantId = customerId;

      logger.debug("[FoldersController.create] Creating folder", {
        tenantId,
        body,
      });

      const newFolder = await folderService.createFolder(
        tenantId,
        body?.folder_name,
        body?.parent_folder_id,
      );

      logger.info("[FoldersController.create] Folder created", {
        tenantId,
        folderId: newFolder.folder_id,
      });

      return {
        statusCode: 201,
        body: newFolder,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error("[FoldersController.create] Error", { error });
      throw new InternalServerError("Failed to create folder");
    }
  }

  async update(
    params: Record<string, string>,
    body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    try {
      const customerId = getCustomerId(context);
      const tenantId = customerId;
      const folderId = params.id;

      logger.debug("[FoldersController.update] Updating folder", {
        tenantId,
        folderId,
        body,
      });

      const updatedFolder = await folderService.updateFolder(
        tenantId,
        folderId,
        {
          folder_name: body.folder_name,
          parent_folder_id: body.parent_folder_id,
        },
      );

      logger.info("[FoldersController.update] Folder updated", {
        tenantId,
        folderId,
      });

      return {
        statusCode: 200,
        body: updatedFolder,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error("[FoldersController.update] Error", { error });
      throw new InternalServerError("Failed to update folder");
    }
  }

  async delete(
    params: Record<string, string>,
    _body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    try {
      const customerId = getCustomerId(context);
      const tenantId = customerId;
      const folderId = params.id;

      logger.debug("[FoldersController.delete] Deleting folder", {
        tenantId,
        folderId,
      });

      await folderService.deleteFolder(tenantId, folderId);

      logger.info("[FoldersController.delete] Folder deleted", {
        tenantId,
        folderId,
      });

      return {
        statusCode: 200,
        body: { message: "Folder deleted successfully" },
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error("[FoldersController.delete] Error", { error });
      throw new InternalServerError("Failed to delete folder");
    }
  }

  async moveWorkflowToFolder(
    params: Record<string, string>,
    body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    try {
      const customerId = getCustomerId(context);
      const tenantId = customerId;
      const workflowId = params.id;

      const folderId = body?.folder_id ?? null;
      if (folderId !== null && typeof folderId !== "string") {
        throw new ValidationError("folder_id must be a string or null");
      }

      const updated = await folderService.moveWorkflowToFolder(
        tenantId,
        workflowId,
        folderId,
      );

      return {
        statusCode: 200,
        body: updated,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error("[FoldersController.moveWorkflowToFolder] Error", { error });
      throw new InternalServerError("Failed to move lead magnet");
    }
  }
}

export const foldersController = new FoldersController();
