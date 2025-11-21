"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.foldersController = void 0;
const ulid_1 = require("ulid");
const db_1 = require("../utils/db");
const validation_1 = require("../utils/validation");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const env_1 = require("../utils/env");
const baseController_1 = require("./baseController");
const FOLDERS_TABLE = env_1.env.foldersTable;
if (!FOLDERS_TABLE) {
    logger_1.logger.error('[Folders Controller] FOLDERS_TABLE environment variable is not set');
}
class FoldersController extends baseController_1.BaseController {
    // @ts-expect-error - Public method with custom signature for routes; base method is protected with different signature
    async list(tenantId, queryParams) {
        if (!FOLDERS_TABLE) {
            throw new errors_1.ApiError('FOLDERS_TABLE environment variable is not configured', 500);
        }
        try {
            const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;
            logger_1.logger.info('[Folders List] Starting query', { tenantId, limit });
            let folders = [];
            try {
                const result = await db_1.db.query(FOLDERS_TABLE, 'gsi_tenant_created', 'tenant_id = :tenant_id', { ':tenant_id': tenantId }, undefined, limit);
                folders = result.items;
            }
            catch (dbError) {
                logger_1.logger.error('[Folders List] Database query error', {
                    error: dbError.message,
                    errorName: dbError.name,
                    table: FOLDERS_TABLE,
                    tenantId,
                });
                // Return empty array if table doesn't exist or permissions issue
                if (dbError.name === 'ResourceNotFoundException' ||
                    dbError.name === 'AccessDeniedException') {
                    folders = [];
                }
                else {
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
            logger_1.logger.info('[Folders List] Query completed', {
                tenantId,
                foldersFound: folders.length,
            });
            return this.listResponse(folders, 'folders');
        }
        catch (error) {
            logger_1.logger.error('[Folders List] Error', {
                error: error.message,
                errorName: error.name,
                stack: error.stack,
                tenantId,
            });
            throw error;
        }
    }
    // @ts-expect-error - Public method with custom signature for routes; base method is protected with different signature
    async get(tenantId, folderId) {
        if (!FOLDERS_TABLE) {
            throw new errors_1.ApiError('FOLDERS_TABLE environment variable is not configured', 500);
        }
        return super.get(FOLDERS_TABLE, { folder_id: folderId }, tenantId, 'folder');
    }
    async create(tenantId, body) {
        if (!FOLDERS_TABLE) {
            throw new errors_1.ApiError('FOLDERS_TABLE environment variable is not configured', 500);
        }
        const data = (0, validation_1.validate)(validation_1.createFolderSchema, body);
        const folderId = `folder_${(0, ulid_1.ulid)()}`;
        const now = new Date().toISOString();
        const folder = {
            folder_id: folderId,
            tenant_id: tenantId,
            folder_name: data.folder_name,
            created_at: now,
            updated_at: now,
        };
        await db_1.db.put(FOLDERS_TABLE, folder);
        logger_1.logger.info('[Folders Create] Folder created', {
            folderId,
            folderName: data.folder_name,
            tenantId,
        });
        return this.created(folder);
    }
    // @ts-expect-error - Public method with custom signature for routes; base method is protected with different signature
    async update(tenantId, folderId, body) {
        if (!FOLDERS_TABLE) {
            throw new errors_1.ApiError('FOLDERS_TABLE environment variable is not configured', 500);
        }
        const data = (0, validation_1.validate)(validation_1.updateFolderSchema, body);
        const updates = {};
        if (data.folder_name !== undefined) {
            updates.folder_name = data.folder_name;
        }
        // Use base update method which handles tenant validation and updated_at
        const result = await super.update(FOLDERS_TABLE, { folder_id: folderId }, updates, tenantId, 'folder');
        logger_1.logger.info('[Folders Update] Folder updated', {
            folderId,
            tenantId,
        });
        return result;
    }
    // @ts-expect-error - Public method with custom signature for routes; base method is protected with different signature
    async delete(tenantId, folderId) {
        if (!FOLDERS_TABLE) {
            throw new errors_1.ApiError('FOLDERS_TABLE environment variable is not configured', 500);
        }
        // Validate tenant access first
        await this.validateTenantAccess(FOLDERS_TABLE, { folder_id: folderId }, tenantId, 'folder');
        // Soft delete the folder
        const deletedAt = new Date().toISOString();
        await db_1.db.update(FOLDERS_TABLE, { folder_id: folderId }, {
            deleted_at: deletedAt,
            updated_at: deletedAt,
        });
        // Move all workflows in this folder to uncategorized (set folder_id to null)
        const { getWorkflowsTable } = await Promise.resolve().then(() => __importStar(require('../utils/env')));
        const WORKFLOWS_TABLE = getWorkflowsTable();
        try {
            // Query all workflows for this tenant and filter by folder_id
            // Since we don't have a GSI on folder_id, we query by tenant and filter
            const result = await db_1.db.query(WORKFLOWS_TABLE, 'gsi_tenant_status', 'tenant_id = :tenant_id', { ':tenant_id': tenantId }, undefined, 1000 // Large limit to get all workflows
            );
            const workflowsInFolder = result.items.filter((w) => w.folder_id === folderId && !w.deleted_at);
            // Update each workflow to remove folder_id
            for (const workflow of workflowsInFolder) {
                await db_1.db.update(WORKFLOWS_TABLE, { workflow_id: workflow.workflow_id }, { folder_id: null, updated_at: deletedAt });
            }
            logger_1.logger.info('[Folders Delete] Folder soft-deleted and workflows moved to uncategorized', {
                folderId,
                tenantId,
                workflowsMoved: workflowsInFolder.length,
            });
        }
        catch (error) {
            logger_1.logger.error('[Folders Delete] Error handling workflow updates', {
                folderId,
                tenantId,
                error: error.message,
            });
            // Continue with folder deletion even if workflow update fails
        }
        logger_1.logger.info('[Folders Delete] Folder deleted', {
            folderId,
            tenantId,
        });
        return this.success({ message: 'Folder deleted successfully' });
    }
}
exports.foldersController = new FoldersController();
//# sourceMappingURL=folders.js.map