import { ulid } from 'ulid';
import { db } from '../utils/db';
import { validate, createFolderSchema, updateFolderSchema } from '../utils/validation';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';
import { logger } from '../utils/logger';
import { env } from '../utils/env';
import { BaseController } from './baseController';
import { Folder } from '../types/resources';

const FOLDERS_TABLE = env.foldersTable;

if (!FOLDERS_TABLE) {
  logger.error('[Folders Controller] FOLDERS_TABLE environment variable is not set');
}

class FoldersController extends BaseController {
  // @ts-expect-error - Public method with custom signature for routes; base method is protected with different signature
  async list(tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse> {
    if (!FOLDERS_TABLE) {
      throw new ApiError('FOLDERS_TABLE environment variable is not configured', 500);
    }

    try {
      const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;

      logger.info('[Folders List] Starting query', { tenantId, limit });

      let folders: Folder[] = [];
      try {
        const result = await db.query(
          FOLDERS_TABLE!,
          'gsi_tenant_created',
          'tenant_id = :tenant_id',
          { ':tenant_id': tenantId },
          undefined,
          limit
        );
        folders = result.items as Folder[];
      } catch (dbError: any) {
        logger.error('[Folders List] Database query error', {
          error: dbError.message,
          errorName: dbError.name,
          table: FOLDERS_TABLE,
          tenantId,
        });
        // Return empty array if table doesn't exist or permissions issue
        if (
          dbError.name === 'ResourceNotFoundException' ||
          dbError.name === 'AccessDeniedException'
        ) {
          folders = [];
        } else {
          throw dbError;
        }
      }

      // Filter out soft-deleted items
      folders = folders.filter((f) => !f.deleted_at);

      // Sort by folder_name alphabetically
      folders.sort((a, b) => {
        const nameA = (a.folder_name || '').toLowerCase();
        const nameB = (b.folder_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      logger.info('[Folders List] Query completed', {
        tenantId,
        foldersFound: folders.length,
      });

      return this.listResponse(folders, 'folders');
    } catch (error: any) {
      logger.error('[Folders List] Error', {
        error: error.message,
        errorName: error.name,
        stack: error.stack,
        tenantId,
      });
      throw error;
    }
  }

  // @ts-expect-error - Public method with custom signature for routes; base method is protected with different signature
  async get(tenantId: string, folderId: string): Promise<RouteResponse> {
    if (!FOLDERS_TABLE) {
      throw new ApiError('FOLDERS_TABLE environment variable is not configured', 500);
    }

    return super.get<Folder>(
      FOLDERS_TABLE!,
      { folder_id: folderId },
      tenantId,
      'folder'
    );
  }

  async create(tenantId: string, body: any): Promise<RouteResponse> {
    if (!FOLDERS_TABLE) {
      throw new ApiError('FOLDERS_TABLE environment variable is not configured', 500);
    }

    const data = validate(createFolderSchema, body);

    const folderId = `folder_${ulid()}`;
    const now = new Date().toISOString();
    const folder: Folder = {
      folder_id: folderId,
      tenant_id: tenantId,
      folder_name: data.folder_name,
      created_at: now,
      updated_at: now,
    };

    await db.put(FOLDERS_TABLE!, folder);

    logger.info('[Folders Create] Folder created', {
      folderId,
      folderName: data.folder_name,
      tenantId,
    });

    return this.created(folder);
  }

  // @ts-expect-error - Public method with custom signature for routes; base method is protected with different signature
  async update(tenantId: string, folderId: string, body: any): Promise<RouteResponse> {
    if (!FOLDERS_TABLE) {
      throw new ApiError('FOLDERS_TABLE environment variable is not configured', 500);
    }

    const data = validate(updateFolderSchema, body);

    const updates: Partial<Folder> = {};
    if (data.folder_name !== undefined) {
      updates.folder_name = data.folder_name;
    }

    // Use base update method which handles tenant validation and updated_at
    const result = await super.update<Folder>(
      FOLDERS_TABLE!,
      { folder_id: folderId },
      updates,
      tenantId,
      'folder'
    );

    logger.info('[Folders Update] Folder updated', {
      folderId,
      tenantId,
    });

    return result;
  }

  // @ts-expect-error - Public method with custom signature for routes; base method is protected with different signature
  async delete(tenantId: string, folderId: string): Promise<RouteResponse> {
    if (!FOLDERS_TABLE) {
      throw new ApiError('FOLDERS_TABLE environment variable is not configured', 500);
    }

    // Validate tenant access first
    await this.validateTenantAccess<Folder>(
      FOLDERS_TABLE!,
      { folder_id: folderId },
      tenantId,
      'folder'
    );

    // Soft delete the folder
    const deletedAt = new Date().toISOString();
    await db.update(FOLDERS_TABLE!, { folder_id: folderId }, {
      deleted_at: deletedAt,
      updated_at: deletedAt,
    });

    // Move all workflows in this folder to uncategorized (set folder_id to null)
    const { getWorkflowsTable } = await import('../utils/env');
    const WORKFLOWS_TABLE = getWorkflowsTable();
    
    try {
      // Query all workflows for this tenant and filter by folder_id
      // Since we don't have a GSI on folder_id, we query by tenant and filter
      const result = await db.query(
        WORKFLOWS_TABLE,
        'gsi_tenant_status',
        'tenant_id = :tenant_id',
        { ':tenant_id': tenantId },
        undefined,
        1000 // Large limit to get all workflows
      );

      const workflowsInFolder = result.items.filter(
        (w: any) => w.folder_id === folderId && !w.deleted_at
      );

      // Update each workflow to remove folder_id
      for (const workflow of workflowsInFolder) {
        await db.update(
          WORKFLOWS_TABLE,
          { workflow_id: workflow.workflow_id },
          { folder_id: null, updated_at: deletedAt }
        );
      }

      logger.info('[Folders Delete] Folder soft-deleted and workflows moved to uncategorized', {
        folderId,
        tenantId,
        workflowsMoved: workflowsInFolder.length,
      });
    } catch (error) {
      logger.error('[Folders Delete] Error handling workflow updates', {
        folderId,
        tenantId,
        error: (error as any).message,
      });
      // Continue with folder deletion even if workflow update fails
    }

    logger.info('[Folders Delete] Folder deleted', {
      folderId,
      tenantId,
    });

    return this.success({ message: 'Folder deleted successfully' });
  }
}

export const foldersController = new FoldersController();

