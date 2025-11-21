"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseController = void 0;
const db_1 = require("../utils/db");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const env_1 = require("../utils/env");
/**
 * Base controller class providing common CRUD patterns and utilities.
 * Reduces code duplication across controllers by centralizing common operations.
 */
class BaseController {
    /**
     * Validate that a resource belongs to the specified tenant.
     * Throws ApiError if resource doesn't exist, is deleted, or doesn't belong to tenant.
     */
    async validateTenantAccess(tableName, key, tenantId, resourceName = 'resource') {
        const resource = await db_1.db.get(tableName, key);
        if (!resource || resource.deleted_at) {
            throw new errors_1.ApiError(`This ${resourceName} doesn't exist or has been removed`, 404);
        }
        if (resource.tenant_id !== tenantId) {
            throw new errors_1.ApiError(`You don't have permission to access this ${resourceName}`, 403);
        }
        return resource;
    }
    /**
     * Standard success response helper.
     */
    success(data, statusCode = 200) {
        return {
            statusCode,
            body: data,
        };
    }
    /**
     * Standard created response helper.
     */
    created(data) {
        return this.success(data, 201);
    }
    /**
     * Standard no content response helper.
     */
    noContent() {
        return {
            statusCode: 204,
            body: {},
        };
    }
    /**
     * Standard list response helper with count.
     */
    listResponse(items, resourceName = 'items') {
        return {
            statusCode: 200,
            body: {
                [resourceName]: items,
                count: items.length,
            },
        };
    }
    /**
     * Filter out soft-deleted items from an array.
     */
    filterDeleted(items) {
        return items.filter((item) => !item.deleted_at);
    }
    /**
     * Sort items by created_at in descending order (most recent first).
     */
    sortByCreatedAtDesc(items) {
        return [...items].sort((a, b) => {
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateB - dateA; // DESC order
        });
    }
    /**
     * Parse limit from query params with default.
     */
    parseLimit(queryParams, defaultLimit = 50) {
        return queryParams.limit ? parseInt(queryParams.limit, 10) : defaultLimit;
    }
    /**
     * Parse offset from query params with default.
     */
    parseOffset(queryParams, defaultOffset = 0) {
        return queryParams.offset ? parseInt(queryParams.offset, 10) : defaultOffset;
    }
    /**
     * Standard get operation with tenant validation.
     */
    async get(tableName, key, tenantId, resourceName = 'resource') {
        const resource = await this.validateTenantAccess(tableName, key, tenantId, resourceName);
        return this.success(resource);
    }
    /**
     * Standard list operation with tenant filtering and soft-delete filtering.
     */
    async list(tableName, indexName, tenantId, queryParams, options = {}) {
        const { limit = 50, statusFilter, statusIndexName, resourceName = 'items', } = options;
        const parsedLimit = this.parseLimit(queryParams, limit);
        let items = [];
        try {
            if (statusFilter && statusIndexName) {
                const result = await db_1.db.query(tableName, statusIndexName, 'tenant_id = :tenant_id AND #status = :status', { ':tenant_id': tenantId, ':status': statusFilter }, { '#status': 'status' }, parsedLimit);
                items = result.items;
            }
            else {
                const result = await db_1.db.query(tableName, indexName, 'tenant_id = :tenant_id', { ':tenant_id': tenantId }, undefined, parsedLimit);
                items = result.items;
            }
        }
        catch (dbError) {
            logger_1.logger.error(`[BaseController] Database query error for ${tableName}`, {
                error: dbError.message,
                errorName: dbError.name,
                table: tableName,
                tenantId,
            });
            // Return empty array if table doesn't exist or permissions issue
            if (dbError.name === 'ResourceNotFoundException' ||
                dbError.name === 'AccessDeniedException') {
                items = [];
            }
            else {
                throw dbError;
            }
        }
        // Filter out soft-deleted items
        const activeItems = this.filterDeleted(items);
        // Sort by created_at DESC
        const sortedItems = this.sortByCreatedAtDesc(activeItems);
        return this.listResponse(sortedItems, resourceName);
    }
    /**
     * Standard create operation.
     */
    async create(tableName, data, tenantId, generateId) {
        const id = generateId();
        const idField = this.getIdFieldName(tableName);
        const resource = {
            ...data,
            tenant_id: tenantId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            [idField]: id,
        };
        await db_1.db.put(tableName, resource);
        return this.created(resource);
    }
    /**
     * Standard update operation with tenant validation.
     */
    async update(tableName, key, updates, tenantId, resourceName = 'resource') {
        // Validate tenant access first
        await this.validateTenantAccess(tableName, key, tenantId, resourceName);
        const updated = await db_1.db.update(tableName, key, {
            ...updates,
            updated_at: new Date().toISOString(),
        });
        return this.success(updated);
    }
    /**
     * Standard delete operation (soft delete) with tenant validation.
     */
    async delete(tableName, key, tenantId, resourceName = 'resource') {
        // Validate tenant access first
        await this.validateTenantAccess(tableName, key, tenantId, resourceName);
        // Soft delete
        await db_1.db.update(tableName, key, {
            deleted_at: new Date().toISOString(),
        });
        return this.noContent();
    }
    /**
     * Infer ID field name from table name.
     * e.g., 'workflows' -> 'workflow_id', 'forms' -> 'form_id'
     */
    getIdFieldName(tableName) {
        // Remove 'leadmagnet-' prefix if present
        const cleanName = tableName.replace(/^leadmagnet-/, '');
        // Convert plural to singular and add '_id'
        const singular = cleanName.replace(/s$/, '');
        return `${singular}_id`;
    }
    /**
     * Get environment configuration.
     */
    getEnv() {
        return env_1.env;
    }
}
exports.BaseController = BaseController;
//# sourceMappingURL=baseController.js.map