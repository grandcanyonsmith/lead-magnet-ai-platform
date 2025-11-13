import { db } from '../utils/db';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';
import { logger } from '../utils/logger';
import { env } from '../utils/env';

/**
 * Base controller class providing common CRUD patterns and utilities.
 * Reduces code duplication across controllers by centralizing common operations.
 */
export abstract class BaseController {
  /**
   * Validate that a resource belongs to the specified tenant.
   * Throws ApiError if resource doesn't exist, is deleted, or doesn't belong to tenant.
   */
  protected async validateTenantAccess<T extends { tenant_id: string; deleted_at?: string }>(
    tableName: string,
    key: Record<string, any>,
    tenantId: string,
    resourceName: string = 'resource'
  ): Promise<T> {
    const resource = await db.get<T>(tableName, key);

    if (!resource || resource.deleted_at) {
      throw new ApiError(`This ${resourceName} doesn't exist or has been removed`, 404);
    }

    if (resource.tenant_id !== tenantId) {
      throw new ApiError(`You don't have permission to access this ${resourceName}`, 403);
    }

    return resource;
  }

  /**
   * Standard success response helper.
   */
  protected success<T>(data: T, statusCode: number = 200): RouteResponse {
    return {
      statusCode,
      body: data,
    };
  }

  /**
   * Standard created response helper.
   */
  protected created<T>(data: T): RouteResponse {
    return this.success(data, 201);
  }

  /**
   * Standard no content response helper.
   */
  protected noContent(): RouteResponse {
    return {
      statusCode: 204,
      body: {},
    };
  }

  /**
   * Standard list response helper with count.
   */
  protected listResponse<T>(items: T[], resourceName: string = 'items'): RouteResponse {
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
  protected filterDeleted<T extends { deleted_at?: string }>(items: T[]): T[] {
    return items.filter((item) => !item.deleted_at);
  }

  /**
   * Sort items by created_at in descending order (most recent first).
   */
  protected sortByCreatedAtDesc<T extends { created_at?: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA; // DESC order
    });
  }

  /**
   * Parse limit from query params with default.
   */
  protected parseLimit(queryParams: Record<string, any>, defaultLimit: number = 50): number {
    return queryParams.limit ? parseInt(queryParams.limit, 10) : defaultLimit;
  }

  /**
   * Parse offset from query params with default.
   */
  protected parseOffset(queryParams: Record<string, any>, defaultOffset: number = 0): number {
    return queryParams.offset ? parseInt(queryParams.offset, 10) : defaultOffset;
  }

  /**
   * Standard get operation with tenant validation.
   */
  protected async get<T extends { tenant_id: string; deleted_at?: string }>(
    tableName: string,
    key: Record<string, any>,
    tenantId: string,
    resourceName: string = 'resource'
  ): Promise<RouteResponse> {
    const resource = await this.validateTenantAccess<T>(tableName, key, tenantId, resourceName);
    return this.success(resource);
  }

  /**
   * Standard list operation with tenant filtering and soft-delete filtering.
   */
  protected async list<T extends { tenant_id: string; deleted_at?: string }>(
    tableName: string,
    indexName: string | undefined,
    tenantId: string,
    queryParams: Record<string, any>,
    options: {
      limit?: number;
      statusFilter?: string;
      statusIndexName?: string;
      resourceName?: string;
    } = {}
  ): Promise<RouteResponse> {
    const {
      limit = 50,
      statusFilter,
      statusIndexName,
      resourceName = 'items',
    } = options;

    const parsedLimit = this.parseLimit(queryParams, limit);
    let items: T[] = [];

    try {
      if (statusFilter && statusIndexName) {
        const result = await db.query(
          tableName,
          statusIndexName,
          'tenant_id = :tenant_id AND #status = :status',
          { ':tenant_id': tenantId, ':status': statusFilter },
          { '#status': 'status' },
          parsedLimit
        );
        items = result.items as T[];
      } else {
        const result = await db.query(
          tableName,
          indexName,
          'tenant_id = :tenant_id',
          { ':tenant_id': tenantId },
          undefined,
          parsedLimit
        );
        items = result.items as T[];
      }
    } catch (dbError: any) {
      logger.error(`[BaseController] Database query error for ${tableName}`, {
        error: dbError.message,
        errorName: dbError.name,
        table: tableName,
        tenantId,
      });

      // Return empty array if table doesn't exist or permissions issue
      if (
        dbError.name === 'ResourceNotFoundException' ||
        dbError.name === 'AccessDeniedException'
      ) {
        items = [];
      } else {
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
  protected async create<T extends { tenant_id: string }>(
    tableName: string,
    data: Omit<T, 'tenant_id' | 'created_at' | 'updated_at'>,
    tenantId: string,
    generateId: () => string
  ): Promise<RouteResponse> {
    const id = generateId();
    const resource = {
      ...data,
      tenant_id: tenantId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as T & { [key: string]: any };

    // Set the ID field based on table name convention
    const idField = this.getIdFieldName(tableName);
    resource[idField] = id;

    await db.put(tableName, resource);
    return this.created(resource);
  }

  /**
   * Standard update operation with tenant validation.
   */
  protected async update<T extends { tenant_id: string; deleted_at?: string }>(
    tableName: string,
    key: Record<string, any>,
    updates: Partial<T>,
    tenantId: string,
    resourceName: string = 'resource'
  ): Promise<RouteResponse> {
    // Validate tenant access first
    await this.validateTenantAccess<T>(tableName, key, tenantId, resourceName);

    const updated = await db.update(
      tableName,
      key,
      {
        ...updates,
        updated_at: new Date().toISOString(),
      } as any
    );

    return this.success(updated);
  }

  /**
   * Standard delete operation (soft delete) with tenant validation.
   */
  protected async delete(
    tableName: string,
    key: Record<string, any>,
    tenantId: string,
    resourceName: string = 'resource'
  ): Promise<RouteResponse> {
    // Validate tenant access first
    await this.validateTenantAccess(tableName, key, tenantId, resourceName);

    // Soft delete
    await db.update(tableName, key, {
      deleted_at: new Date().toISOString(),
    });

    return this.noContent();
  }

  /**
   * Infer ID field name from table name.
   * e.g., 'workflows' -> 'workflow_id', 'forms' -> 'form_id'
   */
  private getIdFieldName(tableName: string): string {
    // Remove 'leadmagnet-' prefix if present
    const cleanName = tableName.replace(/^leadmagnet-/, '');

    // Convert plural to singular and add '_id'
    const singular = cleanName.replace(/s$/, '');
    return `${singular}_id`;
  }

  /**
   * Get environment configuration.
   */
  protected getEnv() {
    return env;
  }
}

