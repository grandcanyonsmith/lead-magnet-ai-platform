import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import { env } from "./env";

console.log("Initializing DB module");

const client = new DynamoDBClient({
  region: env.awsRegion,
});

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

console.log("docClient initialized:", docClient);

export class DynamoDBService {
  async get(tableName: string, key: Record<string, any>) {
    const command = new GetCommand({
      TableName: tableName,
      Key: key,
    });

    // ... existing code ...
    const result = await docClient.send(command);
    return result.Item;
  }

  async put(tableName: string, item: Record<string, any>) {
    const command = new PutCommand({
      TableName: tableName,
      Item: item,
    });

    await docClient.send(command);
    return item;
  }

  async update(
    tableName: string,
    key: Record<string, any>,
    updates: Record<string, any>,
  ) {
    // Validate inputs
    if (
      !tableName ||
      typeof tableName !== "string" ||
      tableName.trim().length === 0
    ) {
      throw new Error("Table name is required and must be a non-empty string");
    }

    if (!key || Object.keys(key).length === 0) {
      throw new Error("Key is required and must be a non-empty object");
    }

    if (!updates || Object.keys(updates).length === 0) {
      throw new Error(
        "Updates object is required and must contain at least one field to update",
      );
    }

    // Filter out undefined values from updates
    const filteredUpdates = Object.entries(updates).reduce(
      (acc, [k, v]) => {
        if (v !== undefined) {
          acc[k] = v;
        }
        return acc;
      },
      {} as Record<string, any>,
    );

    if (Object.keys(filteredUpdates).length === 0) {
      throw new Error(
        "Updates object must contain at least one non-undefined value",
      );
    }

    try {
      const updateExpression = Object.keys(filteredUpdates)
        .map((k) => `#${k} = :${k}`)
        .join(", ");

      const expressionAttributeNames = Object.keys(filteredUpdates).reduce(
        (acc, k) => ({ ...acc, [`#${k}`]: k }),
        {},
      );

      const expressionAttributeValues = Object.keys(filteredUpdates).reduce(
        (acc, k) => ({ ...acc, [`:${k}`]: filteredUpdates[k] }),
        {},
      );

      const command = new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression: `SET ${updateExpression}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW",
      });

      const result = await docClient.send(command);

      // Validate that we got a result back
      if (!result || !result.Attributes) {
        throw new Error(
          `DynamoDB update operation completed but returned no attributes. Table: ${tableName}, Key: ${JSON.stringify(key)}`,
        );
      }

      return result.Attributes;
    } catch (error) {
      // Re-throw with more context
      if (error instanceof Error) {
        throw new Error(
          `Failed to update DynamoDB item: ${error.message}. Table: ${tableName}, Key: ${JSON.stringify(key)}, Updates: ${JSON.stringify(Object.keys(filteredUpdates))}`,
        );
      }
      throw error;
    }
  }

  async delete(tableName: string, key: Record<string, any>) {
    const command = new DeleteCommand({
      TableName: tableName,
      Key: key,
    });

    await docClient.send(command);
  }

  async batchGet(
    tableName: string,
    keys: Record<string, any>[],
  ): Promise<Record<string, any>[]> {
    if (!keys || keys.length === 0) {
      return [];
    }

    // DynamoDB BatchGetItem limit is 100 items (25 used to be the limit for write, read is 100)
    // However, we'll use chunks of 25 to be safe and consistent
    const chunkSize = 25;
    const chunks = [];
    for (let i = 0; i < keys.length; i += chunkSize) {
      chunks.push(keys.slice(i, i + chunkSize));
    }

    const results: Record<string, any>[] = [];

    for (const chunk of chunks) {
      const command = new BatchGetCommand({
        RequestItems: {
          [tableName]: {
            Keys: chunk,
          },
        },
      });

      const response = await docClient.send(command);
      if (response.Responses && response.Responses[tableName]) {
        results.push(...response.Responses[tableName]);
      }
      
      // Note: We're not handling UnprocessedKeys for simplicity in this optimization pass.
      // In a robust system, we should retry unprocessed keys.
    }

    return results;
  }

  async query(
    tableName: string,
    indexName: string | undefined,
    keyCondition: string,
    expressionAttributeValues: Record<string, any>,
    expressionAttributeNames?: Record<string, string>,
    limit?: number,
    exclusiveStartKey?: Record<string, any>,
  ): Promise<{
    items: Record<string, any>[];
    lastEvaluatedKey?: Record<string, any>;
  }> {
    const params: any = {
      TableName: tableName,
      KeyConditionExpression: keyCondition,
      ScanIndexForward: false, // Sort descending by default
    };

    // Only add ExpressionAttributeValues if not empty
    if (
      expressionAttributeValues &&
      Object.keys(expressionAttributeValues).length > 0
    ) {
      params.ExpressionAttributeValues = expressionAttributeValues;
    }

    if (indexName) {
      params.IndexName = indexName;
    }

    if (
      expressionAttributeNames &&
      Object.keys(expressionAttributeNames).length > 0
    ) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }

    if (limit) {
      params.Limit = limit;
    }

    if (exclusiveStartKey) {
      params.ExclusiveStartKey = exclusiveStartKey;
    }

    const command = new QueryCommand(params);

    const result = await docClient.send(command);

    return {
      items: result.Items || [],
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }

  async scan(tableName: string, limit?: number) {
    const command = new ScanCommand({
      TableName: tableName,
      Limit: limit,
    });

    const result = await docClient.send(command);
    return result.Items || [];
  }
}

/**
 * Normalize query result to always return an array
 * Handles both array return format and paginated object format
 */
export function normalizeQueryResult<T = any>(
  result: T[] | { items: T[]; lastEvaluatedKey?: Record<string, any> },
): T[] {
  return Array.isArray(result) ? result : result.items;
}

export const db = new DynamoDBService();
