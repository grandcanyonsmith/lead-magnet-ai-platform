"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.DynamoDBService = exports.docClient = void 0;
exports.normalizeQueryResult = normalizeQueryResult;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const env_1 = require("./env");
const client = new client_dynamodb_1.DynamoDBClient({
    region: env_1.env.awsRegion,
});
exports.docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
    },
    unmarshallOptions: {
        wrapNumbers: false,
    },
});
class DynamoDBService {
    async get(tableName, key) {
        const command = new lib_dynamodb_1.GetCommand({
            TableName: tableName,
            Key: key,
        });
        const result = await exports.docClient.send(command);
        return result.Item;
    }
    async put(tableName, item) {
        const command = new lib_dynamodb_1.PutCommand({
            TableName: tableName,
            Item: item,
        });
        await exports.docClient.send(command);
        return item;
    }
    async update(tableName, key, updates) {
        // Validate inputs
        if (!tableName || typeof tableName !== 'string' || tableName.trim().length === 0) {
            throw new Error('Table name is required and must be a non-empty string');
        }
        if (!key || Object.keys(key).length === 0) {
            throw new Error('Key is required and must be a non-empty object');
        }
        if (!updates || Object.keys(updates).length === 0) {
            throw new Error('Updates object is required and must contain at least one field to update');
        }
        // Filter out undefined values from updates
        const filteredUpdates = Object.entries(updates).reduce((acc, [k, v]) => {
            if (v !== undefined) {
                acc[k] = v;
            }
            return acc;
        }, {});
        if (Object.keys(filteredUpdates).length === 0) {
            throw new Error('Updates object must contain at least one non-undefined value');
        }
        try {
            const updateExpression = Object.keys(filteredUpdates)
                .map((k) => `#${k} = :${k}`)
                .join(', ');
            const expressionAttributeNames = Object.keys(filteredUpdates).reduce((acc, k) => ({ ...acc, [`#${k}`]: k }), {});
            const expressionAttributeValues = Object.keys(filteredUpdates).reduce((acc, k) => ({ ...acc, [`:${k}`]: filteredUpdates[k] }), {});
            const command = new lib_dynamodb_1.UpdateCommand({
                TableName: tableName,
                Key: key,
                UpdateExpression: `SET ${updateExpression}`,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
                ReturnValues: 'ALL_NEW',
            });
            const result = await exports.docClient.send(command);
            // Validate that we got a result back
            if (!result || !result.Attributes) {
                throw new Error(`DynamoDB update operation completed but returned no attributes. Table: ${tableName}, Key: ${JSON.stringify(key)}`);
            }
            return result.Attributes;
        }
        catch (error) {
            // Re-throw with more context
            if (error instanceof Error) {
                throw new Error(`Failed to update DynamoDB item: ${error.message}. Table: ${tableName}, Key: ${JSON.stringify(key)}, Updates: ${JSON.stringify(Object.keys(filteredUpdates))}`);
            }
            throw error;
        }
    }
    async delete(tableName, key) {
        const command = new lib_dynamodb_1.DeleteCommand({
            TableName: tableName,
            Key: key,
        });
        await exports.docClient.send(command);
    }
    async query(tableName, indexName, keyCondition, expressionAttributeValues, expressionAttributeNames, limit, exclusiveStartKey) {
        const params = {
            TableName: tableName,
            KeyConditionExpression: keyCondition,
            ScanIndexForward: false, // Sort descending by default
        };
        // Only add ExpressionAttributeValues if not empty
        if (expressionAttributeValues && Object.keys(expressionAttributeValues).length > 0) {
            params.ExpressionAttributeValues = expressionAttributeValues;
        }
        if (indexName) {
            params.IndexName = indexName;
        }
        if (expressionAttributeNames && Object.keys(expressionAttributeNames).length > 0) {
            params.ExpressionAttributeNames = expressionAttributeNames;
        }
        if (limit) {
            params.Limit = limit;
        }
        if (exclusiveStartKey) {
            params.ExclusiveStartKey = exclusiveStartKey;
        }
        const command = new lib_dynamodb_1.QueryCommand(params);
        const result = await exports.docClient.send(command);
        return {
            items: result.Items || [],
            lastEvaluatedKey: result.LastEvaluatedKey,
        };
    }
    async scan(tableName, limit) {
        const command = new lib_dynamodb_1.ScanCommand({
            TableName: tableName,
            Limit: limit,
        });
        const result = await exports.docClient.send(command);
        return result.Items || [];
    }
    async scanPaginated(tableName, limit, exclusiveStartKey) {
        const command = new lib_dynamodb_1.ScanCommand({
            TableName: tableName,
            Limit: limit,
            ExclusiveStartKey: exclusiveStartKey,
        });
        const result = await exports.docClient.send(command);
        return {
            items: result.Items || [],
            lastEvaluatedKey: result.LastEvaluatedKey,
        };
    }
    /**
     * Retrieve all items in a table by scanning until exhaustion.
     * Accepts an optional maxItems to avoid unbounded reads in very large tables.
     */
    async scanAll(tableName, pageSize = 200, maxItems) {
        const items = [];
        let lastEvaluatedKey = undefined;
        do {
            const { items: page, lastEvaluatedKey: lek } = await this.scanPaginated(tableName, pageSize, lastEvaluatedKey);
            items.push(...page);
            if (maxItems && items.length >= maxItems) {
                return items.slice(0, maxItems);
            }
            lastEvaluatedKey = lek;
        } while (lastEvaluatedKey);
        return items;
    }
}
exports.DynamoDBService = DynamoDBService;
/**
 * Normalize query result to always return an array
 * Handles both array return format and paginated object format
 */
function normalizeQueryResult(result) {
    return Array.isArray(result) ? result : result.items;
}
exports.db = new DynamoDBService();
//# sourceMappingURL=db.js.map