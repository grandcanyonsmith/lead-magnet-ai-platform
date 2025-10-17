import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
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

export class DynamoDBService {
  async get(tableName: string, key: Record<string, any>) {
    const command = new GetCommand({
      TableName: tableName,
      Key: key,
    });

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
    updates: Record<string, any>
  ) {
    const updateExpression = Object.keys(updates)
      .map((k) => `#${k} = :${k}`)
      .join(', ');

    const expressionAttributeNames = Object.keys(updates).reduce(
      (acc, k) => ({ ...acc, [`#${k}`]: k }),
      {}
    );

    const expressionAttributeValues = Object.keys(updates).reduce(
      (acc, k) => ({ ...acc, [`:${k}`]: updates[k] }),
      {}
    );

    const command = new UpdateCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: `SET ${updateExpression}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    const result = await docClient.send(command);
    return result.Attributes;
  }

  async delete(tableName: string, key: Record<string, any>) {
    const command = new DeleteCommand({
      TableName: tableName,
      Key: key,
    });

    await docClient.send(command);
  }

  async query(
    tableName: string,
    indexName: string | undefined,
    keyCondition: string,
    expressionAttributeValues: Record<string, any>,
    expressionAttributeNames?: Record<string, string>,
    limit?: number
  ) {
    const params: any = {
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

    const command = new QueryCommand(params);

    const result = await docClient.send(command);
    return result.Items || [];
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

export const db = new DynamoDBService();

