import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
export declare const docClient: DynamoDBDocumentClient;
export declare class DynamoDBService {
    get(tableName: string, key: Record<string, any>): Promise<Record<string, any> | undefined>;
    put(tableName: string, item: Record<string, any>): Promise<Record<string, any>>;
    update(tableName: string, key: Record<string, any>, updates: Record<string, any>): Promise<Record<string, any>>;
    delete(tableName: string, key: Record<string, any>): Promise<void>;
    query(tableName: string, indexName: string | undefined, keyCondition: string, expressionAttributeValues: Record<string, any>, expressionAttributeNames?: Record<string, string>, limit?: number, exclusiveStartKey?: Record<string, any>): Promise<{
        items: Record<string, any>[];
        lastEvaluatedKey?: Record<string, any>;
    }>;
    scan(tableName: string, limit?: number): Promise<Record<string, any>[]>;
    scanPaginated(tableName: string, limit?: number, exclusiveStartKey?: Record<string, any>): Promise<{
        items: Record<string, any>[];
        lastEvaluatedKey?: Record<string, any>;
    }>;
    /**
     * Retrieve all items in a table by scanning until exhaustion.
     * Accepts an optional maxItems to avoid unbounded reads in very large tables.
     */
    scanAll(tableName: string, pageSize?: number, maxItems?: number): Promise<Record<string, any>[]>;
}
/**
 * Normalize query result to always return an array
 * Handles both array return format and paginated object format
 */
export declare function normalizeQueryResult<T = any>(result: T[] | {
    items: T[];
    lastEvaluatedKey?: Record<string, any>;
}): T[];
export declare const db: DynamoDBService;
//# sourceMappingURL=db.d.ts.map