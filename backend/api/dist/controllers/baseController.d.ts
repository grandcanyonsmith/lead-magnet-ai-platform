import { RouteResponse } from '../routes';
/**
 * Base controller class providing common CRUD patterns and utilities.
 * Reduces code duplication across controllers by centralizing common operations.
 */
export declare abstract class BaseController {
    /**
     * Validate that a resource belongs to the specified tenant.
     * Throws ApiError if resource doesn't exist, is deleted, or doesn't belong to tenant.
     */
    protected validateTenantAccess<T extends {
        tenant_id: string;
        deleted_at?: string;
    }>(tableName: string, key: Record<string, any>, tenantId: string, resourceName?: string): Promise<T>;
    /**
     * Standard success response helper.
     */
    protected success<T>(data: T, statusCode?: number): RouteResponse;
    /**
     * Standard created response helper.
     */
    protected created<T>(data: T): RouteResponse;
    /**
     * Standard no content response helper.
     */
    protected noContent(): RouteResponse;
    /**
     * Standard list response helper with count.
     */
    protected listResponse<T>(items: T[], resourceName?: string): RouteResponse;
    /**
     * Filter out soft-deleted items from an array.
     */
    protected filterDeleted<T extends {
        deleted_at?: string;
    }>(items: T[]): T[];
    /**
     * Sort items by created_at in descending order (most recent first).
     */
    protected sortByCreatedAtDesc<T extends {
        created_at?: string;
    }>(items: T[]): T[];
    /**
     * Parse limit from query params with default.
     */
    protected parseLimit(queryParams: Record<string, any>, defaultLimit?: number): number;
    /**
     * Parse offset from query params with default.
     */
    protected parseOffset(queryParams: Record<string, any>, defaultOffset?: number): number;
    /**
     * Standard get operation with tenant validation.
     */
    protected get<T extends {
        tenant_id: string;
        deleted_at?: string;
    }>(tableName: string, key: Record<string, any>, tenantId: string, resourceName?: string): Promise<RouteResponse>;
    /**
     * Standard list operation with tenant filtering and soft-delete filtering.
     */
    protected list<T extends {
        tenant_id: string;
        deleted_at?: string;
    }>(tableName: string, indexName: string | undefined, tenantId: string, queryParams: Record<string, any>, options?: {
        limit?: number;
        statusFilter?: string;
        statusIndexName?: string;
        resourceName?: string;
    }): Promise<RouteResponse>;
    /**
     * Standard create operation.
     */
    protected create<T extends {
        tenant_id: string;
    }>(tableName: string, data: Omit<T, 'tenant_id' | 'created_at' | 'updated_at'>, tenantId: string, generateId: () => string): Promise<RouteResponse>;
    /**
     * Standard update operation with tenant validation.
     */
    protected update<T extends {
        tenant_id: string;
        deleted_at?: string;
    }>(tableName: string, key: Record<string, any>, updates: Partial<T>, tenantId: string, resourceName?: string): Promise<RouteResponse>;
    /**
     * Standard delete operation (soft delete) with tenant validation.
     */
    protected delete(tableName: string, key: Record<string, any>, tenantId: string, resourceName?: string): Promise<RouteResponse>;
    /**
     * Infer ID field name from table name.
     * e.g., 'workflows' -> 'workflow_id', 'forms' -> 'form_id'
     */
    private getIdFieldName;
    /**
     * Get environment configuration.
     */
    protected getEnv(): import("../utils/env").EnvConfig;
}
//# sourceMappingURL=baseController.d.ts.map