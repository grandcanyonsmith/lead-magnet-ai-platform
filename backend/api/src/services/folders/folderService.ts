import { ulid } from "ulid";
import { db } from "../../utils/db";
import { logger } from "../../utils/logger";
import {
  InternalServerError,
  NotFoundError,
  ValidationError,
  ApiError,
} from "../../utils/errors";
import { env } from "../../utils/env";

const USER_SETTINGS_TABLE = env.userSettingsTable;
const WORKFLOWS_TABLE = env.workflowsTable;

export interface Folder {
  folder_id: string;
  folder_name: string;
  parent_folder_id?: string | null;
  created_at: string;
  updated_at: string;
  workflow_count?: number;
}

export class FolderService {
  private async ensureSettings(tenantId: string): Promise<any> {
    if (!USER_SETTINGS_TABLE) {
      throw new InternalServerError(
        "USER_SETTINGS_TABLE environment variable is not configured",
      );
    }

    let settings = await db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId });

    if (!settings) {
      const now = new Date().toISOString();
      settings = {
        tenant_id: tenantId,
        organization_name: "",
        contact_email: "",
        default_ai_model: "gpt-5.2",
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

  async listFolders(tenantId: string): Promise<Folder[]> {
    if (!WORKFLOWS_TABLE) {
      throw new InternalServerError(
        "WORKFLOWS_TABLE environment variable is not configured",
      );
    }

    const settings = await this.ensureSettings(tenantId);
    const folders = settings?.folders || [];

    const workflowsResult = await db.query(
      WORKFLOWS_TABLE,
      "gsi_tenant_status",
      "tenant_id = :tenant_id",
      { ":tenant_id": tenantId },
    );
    const workflows = workflowsResult.items.filter((w: any) => !w.deleted_at);

    const folderCounts: Record<string, number> = {};
    for (const workflow of workflows) {
      const folderId = workflow.folder_id || "root";
      folderCounts[folderId] = (folderCounts[folderId] || 0) + 1;
    }

    return folders.map((folder: Folder) => ({
      ...folder,
      workflow_count: folderCounts[folder.folder_id] || 0,
    }));
  }

  async getFolder(tenantId: string, folderId: string): Promise<Folder> {
    const settings = await this.ensureSettings(tenantId);
    const folders = settings?.folders || [];
    const folder = folders.find((f: Folder) => f.folder_id === folderId);

    if (!folder) {
      throw new NotFoundError("Folder not found");
    }

    return folder;
  }

  async createFolder(
    tenantId: string,
    folderName: string,
    parentFolderId?: string | null,
  ): Promise<Folder> {
    if (!folderName || !folderName.trim()) {
      throw new ValidationError("folder_name is required");
    }

    const settings = await this.ensureSettings(tenantId);
    const folders: Folder[] = settings?.folders || [];

    const existingFolder = folders.find(
      (f) =>
        f.folder_name.toLowerCase() === folderName.trim().toLowerCase(),
    );
    if (existingFolder) {
      throw new ValidationError("A folder with this name already exists");
    }

    const now = new Date().toISOString();
    const newFolder: Folder = {
      folder_id: `fld_${ulid()}`,
      folder_name: folderName.trim(),
      parent_folder_id: parentFolderId || null,
      created_at: now,
      updated_at: now,
    };

    folders.push(newFolder);
    await this.saveFolders(tenantId, folders);

    return newFolder;
  }

  async updateFolder(
    tenantId: string,
    folderId: string,
    updates: { folder_name?: string; parent_folder_id?: string | null },
  ): Promise<Folder> {
    const settings = await this.ensureSettings(tenantId);
    const folders: Folder[] = settings?.folders || [];
    const folderIndex = folders.findIndex((f) => f.folder_id === folderId);

    if (folderIndex === -1) {
      throw new NotFoundError("Folder not found");
    }

    if (updates.folder_name && updates.folder_name.trim()) {
      const existingFolder = folders.find(
        (f) =>
          f.folder_id !== folderId &&
          f.folder_name.toLowerCase() ===
            updates.folder_name!.trim().toLowerCase(),
      );
      if (existingFolder) {
        throw new ValidationError("A folder with this name already exists");
      }
      folders[folderIndex].folder_name = updates.folder_name.trim();
    }

    if (updates.parent_folder_id !== undefined) {
      folders[folderIndex].parent_folder_id = updates.parent_folder_id;
    }

    folders[folderIndex].updated_at = new Date().toISOString();
    await this.saveFolders(tenantId, folders);

    return folders[folderIndex];
  }

  async deleteFolder(tenantId: string, folderId: string): Promise<void> {
    if (!WORKFLOWS_TABLE) {
      throw new InternalServerError(
        "WORKFLOWS_TABLE environment variable is not configured",
      );
    }

    const settings = await this.ensureSettings(tenantId);
    const folders: Folder[] = settings?.folders || [];
    const folderIndex = folders.findIndex((f) => f.folder_id === folderId);

    if (folderIndex === -1) {
      throw new NotFoundError("Folder not found");
    }

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

    folders.splice(folderIndex, 1);
    await this.saveFolders(tenantId, folders);
  }

  async moveWorkflowToFolder(
    tenantId: string,
    workflowId: string,
    folderId: string | null,
  ): Promise<any> {
    if (!WORKFLOWS_TABLE) {
      throw new InternalServerError(
        "WORKFLOWS_TABLE environment variable is not configured",
      );
    }

    if (folderId) {
      const settings = await this.ensureSettings(tenantId);
      const folders: Folder[] = settings?.folders || [];
      const exists = folders.some((f) => f.folder_id === folderId);
      if (!exists) {
        throw new NotFoundError("Folder not found");
      }
    }

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

    return updated;
  }
}

export const folderService = new FolderService();
