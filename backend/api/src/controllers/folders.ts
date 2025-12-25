import { ulid } from "ulid";
import { db } from "../utils/db";
import { RouteResponse } from "../routes";
import { RequestContext } from "../routes/router";
import { getCustomerId } from "../utils/rbac";
import { logger } from "../utils/logger";
import {
  ApiError,
  InternalServerError,
  NotFoundError,
  ValidationError,
} from "../utils/errors";
import { env } from "../utils/env";

const USER_SETTINGS_TABLE = env.userSettingsTable;
const WORKFLOWS_TABLE = env.workflowsTable;

interface Folder {
  folder_id: string;
  folder_name: string;
  parent_folder_id?: string | null;
  created_at: string;
  updated_at: string;
}

class FoldersController {
  private async ensureSettings(tenantId: string): Promise<any> {
    if (!USER_SETTINGS_TABLE) {
      throw new InternalServerError(
        "USER_SETTINGS_TABLE environment variable is not configured",
      );
    }

    let settings = await db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId });

    // If settings don't exist yet, create a full default settings record.
    // This prevents folder actions from accidentally creating an incomplete settings item via UpdateItem upsert.
    if (!settings) {
      const now = new Date().toISOString();
      settings = {
        tenant_id: tenantId,
        organization_name: "",
        contact_email: "",
        default_ai_model: "gpt-5.1-codex",
        api_usage_limit: 1000000,
        api_usage_current: 0,
        billing_tier: "free",
        onboarding_survey_completed: false,
        onboarding_survey_responses: {},
        onboarding_checklist: {
          complete_profile: false,
          create_first_lead_magnet: false,
          view_generated_lead_magnets: false,
        },
        folders: [],
        created_at: now,
        updated_at: now,
      };
      await db.put(USER_SETTINGS_TABLE, settings);
      return settings;
    }

    // Ensure folders is always an array
    if (!Array.isArray(settings.folders)) {
      settings = await db.update(
        USER_SETTINGS_TABLE,
        { tenant_id: tenantId },
        {
          folders: [],
          updated_at: new Date().toISOString(),
        },
      );
    }

    return settings;
  }

  private async getFolders(tenantId: string): Promise<Folder[]> {
    const settings = await this.ensureSettings(tenantId);
    return settings?.folders || [];
  }

  private async saveFolders(
    tenantId: string,
    folders: Folder[],
  ): Promise<void> {
    await this.ensureSettings(tenantId);
    await db.update(
      USER_SETTINGS_TABLE,
      { tenant_id: tenantId },
      {
        folders,
        updated_at: new Date().toISOString(),
      },
    );
  }

  async list(
    _params: Record<string, string>,
    _body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    try {
      if (!WORKFLOWS_TABLE) {
        throw new InternalServerError(
          "WORKFLOWS_TABLE environment variable is not configured",
        );
      }
      const customerId = getCustomerId(context);
      const tenantId = customerId;

      logger.debug("[FoldersController.list] Listing folders", { tenantId });

      const folders = await this.getFolders(tenantId);

      // Get workflow counts per folder
      const workflowsResult = await db.query(
        WORKFLOWS_TABLE,
        "gsi_tenant_status",
        "tenant_id = :tenant_id",
        { ":tenant_id": tenantId },
      );
      const workflows = workflowsResult.items.filter((w: any) => !w.deleted_at);

      // Count workflows per folder
      const folderCounts: Record<string, number> = {};
      for (const workflow of workflows) {
        const folderId = workflow.folder_id || "root";
        folderCounts[folderId] = (folderCounts[folderId] || 0) + 1;
      }

      // Add workflow_count to each folder
      const foldersWithCounts = folders.map((folder) => ({
        ...folder,
        workflow_count: folderCounts[folder.folder_id] || 0,
      }));

      return {
        statusCode: 200,
        body: {
          folders: foldersWithCounts,
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

      const folders = await this.getFolders(tenantId);
      const folder = folders.find((f) => f.folder_id === folderId);

      if (!folder) {
        throw new NotFoundError("Folder not found");
      }

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

      if (
        !body?.folder_name ||
        typeof body.folder_name !== "string" ||
        !body.folder_name.trim()
      ) {
        throw new ValidationError("folder_name is required");
      }

      const folders = await this.getFolders(tenantId);

      // Check for duplicate name
      const existingFolder = folders.find(
        (f) =>
          f.folder_name.toLowerCase() === body.folder_name.trim().toLowerCase(),
      );
      if (existingFolder) {
        throw new ValidationError("A folder with this name already exists");
      }

      const now = new Date().toISOString();
      const newFolder: Folder = {
        folder_id: `fld_${ulid()}`,
        folder_name: body.folder_name.trim(),
        parent_folder_id: body.parent_folder_id || null,
        created_at: now,
        updated_at: now,
      };

      folders.push(newFolder);
      await this.saveFolders(tenantId, folders);

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

      const folders = await this.getFolders(tenantId);
      const folderIndex = folders.findIndex((f) => f.folder_id === folderId);

      if (folderIndex === -1) {
        throw new NotFoundError("Folder not found");
      }

      // Check for duplicate name if name is being changed
      if (body.folder_name && body.folder_name.trim()) {
        const existingFolder = folders.find(
          (f) =>
            f.folder_id !== folderId &&
            f.folder_name.toLowerCase() ===
              body.folder_name.trim().toLowerCase(),
        );
        if (existingFolder) {
          throw new ValidationError("A folder with this name already exists");
        }
        folders[folderIndex].folder_name = body.folder_name.trim();
      }

      if (body.parent_folder_id !== undefined) {
        folders[folderIndex].parent_folder_id = body.parent_folder_id;
      }

      folders[folderIndex].updated_at = new Date().toISOString();
      await this.saveFolders(tenantId, folders);

      logger.info("[FoldersController.update] Folder updated", {
        tenantId,
        folderId,
      });

      return {
        statusCode: 200,
        body: folders[folderIndex],
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
      if (!WORKFLOWS_TABLE) {
        throw new InternalServerError(
          "WORKFLOWS_TABLE environment variable is not configured",
        );
      }
      const customerId = getCustomerId(context);
      const tenantId = customerId;
      const folderId = params.id;

      logger.debug("[FoldersController.delete] Deleting folder", {
        tenantId,
        folderId,
      });

      const folders = await this.getFolders(tenantId);
      const folderIndex = folders.findIndex((f) => f.folder_id === folderId);

      if (folderIndex === -1) {
        throw new NotFoundError("Folder not found");
      }

      // Move all workflows in this folder back to root (folder_id = null)
      const workflowsResult = await db.query(
        WORKFLOWS_TABLE,
        "gsi_tenant_status",
        "tenant_id = :tenant_id",
        { ":tenant_id": tenantId },
      );
      const workflows = workflowsResult.items.filter(
        (w: any) => !w.deleted_at && w.folder_id === folderId,
      );

      for (const workflow of workflows) {
        await db.update(
          WORKFLOWS_TABLE,
          { workflow_id: workflow.workflow_id },
          {
            folder_id: null,
            updated_at: new Date().toISOString(),
          },
        );
      }

      // Remove folder
      folders.splice(folderIndex, 1);
      await this.saveFolders(tenantId, folders);

      logger.info("[FoldersController.delete] Folder deleted", {
        tenantId,
        folderId,
        movedWorkflows: workflows.length,
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
      if (!WORKFLOWS_TABLE) {
        throw new InternalServerError(
          "WORKFLOWS_TABLE environment variable is not configured",
        );
      }

      const customerId = getCustomerId(context);
      const tenantId = customerId;
      const workflowId = params.id;

      const folderId = body?.folder_id ?? null;
      if (folderId !== null && typeof folderId !== "string") {
        throw new ValidationError("folder_id must be a string or null");
      }

      // Validate folder existence (if moving into a folder)
      if (folderId) {
        const folders = await this.getFolders(tenantId);
        const exists = folders.some((f) => f.folder_id === folderId);
        if (!exists) {
          throw new NotFoundError("Folder not found");
        }
      }

      // Validate workflow existence and ownership
      const existing = await db.get(WORKFLOWS_TABLE, {
        workflow_id: workflowId,
      });
      if (!existing || existing.deleted_at) {
        throw new NotFoundError("Lead magnet not found");
      }
      if (existing.tenant_id !== tenantId) {
        throw new ApiError(
          "You do not have permission to access this lead magnet",
          403,
        );
      }

      const updated = await db.update(
        WORKFLOWS_TABLE,
        { workflow_id: workflowId },
        {
          folder_id: folderId,
          updated_at: new Date().toISOString(),
        },
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
