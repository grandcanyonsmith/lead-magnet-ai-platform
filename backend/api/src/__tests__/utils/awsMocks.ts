/**
 * AWS SDK mocks for testing
 */

import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// Mock data stores
const mockDynamoDBStore: Map<string, Map<string, any>> = new Map();
const mockS3Store: Map<string, Buffer> = new Map();
const mockSecretsStore: Map<string, string> = new Map();

/**
 * Reset all mock stores
 */
export function resetMocks(): void {
  mockDynamoDBStore.clear();
  mockS3Store.clear();
  mockSecretsStore.clear();
}

/**
 * Setup mock data in DynamoDB store
 */
export function setupDynamoDBItem(tableName: string, key: Record<string, any>, item: any): void {
  const tableStore = mockDynamoDBStore.get(tableName) || new Map();
  const keyString = JSON.stringify(key);
  tableStore.set(keyString, item);
  mockDynamoDBStore.set(tableName, tableStore);
}

/**
 * Setup mock data in S3 store
 */
export function setupS3Object(key: string, buffer: Buffer): void {
  mockS3Store.set(key, buffer);
}

/**
 * Setup mock secret
 */
export function setupSecret(secretId: string, secretValue: string): void {
  mockSecretsStore.set(secretId, secretValue);
}

// Mock DynamoDB Client
export const mockDynamoDBClient = {
  send: jest.fn(async (command: any) => {
    if (command instanceof GetCommand) {
      const tableStore = mockDynamoDBStore.get(command.input.TableName!);
      if (!tableStore) {
        return { Item: undefined };
      }
      const keyString = JSON.stringify(command.input.Key);
      const item = tableStore.get(keyString);
      return { Item: item };
    }

    if (command instanceof PutCommand) {
      const tableStore = mockDynamoDBStore.get(command.input.TableName!) || new Map();
      const keyString = JSON.stringify(
        Object.keys(command.input.Item!)
          .filter((k) => k.endsWith('_id') || k === 'tenant_id')
          .reduce((acc, k) => ({ ...acc, [k]: command.input.Item![k] }), {})
      );
      tableStore.set(keyString, command.input.Item);
      mockDynamoDBStore.set(command.input.TableName!, tableStore);
      return {};
    }

    if (command instanceof UpdateCommand) {
      const tableStore = mockDynamoDBStore.get(command.input.TableName!);
      if (!tableStore) {
        throw new Error('Table not found');
      }
      const keyString = JSON.stringify(command.input.Key);
      const existingItem = tableStore.get(keyString);
      if (!existingItem) {
        throw new Error('Item not found');
      }
      const updatedItem = { ...existingItem, ...command.input.ExpressionAttributeValues };
      tableStore.set(keyString, updatedItem);
      return { Attributes: updatedItem };
    }

    if (command instanceof QueryCommand) {
      const tableStore = mockDynamoDBStore.get(command.input.TableName!);
      if (!tableStore) {
        return { Items: [], LastEvaluatedKey: undefined };
      }
      // Simple mock - in real tests, you'd filter based on key condition
      const items = Array.from(tableStore.values());
      return { Items: items, LastEvaluatedKey: undefined };
    }

    if (command instanceof ScanCommand) {
      const tableStore = mockDynamoDBStore.get(command.input.TableName!);
      if (!tableStore) {
        return { Items: [] };
      }
      const items = Array.from(tableStore.values());
      return { Items: items };
    }

    return {};
  }),
};

// Mock S3 Client
export const mockS3Client = {
  send: jest.fn(async (command: any) => {
    if (command instanceof PutObjectCommand) {
      const key = command.input.Key!;
      const body = command.input.Body as Buffer;
      mockS3Store.set(key, body);
      return {};
    }

    if (command instanceof GetObjectCommand) {
      const key = command.input.Key!;
      const buffer = mockS3Store.get(key);
      if (!buffer) {
        throw new Error('NoSuchKey');
      }
      return { Body: buffer, ContentType: 'application/octet-stream' };
    }

    if (command instanceof DeleteObjectCommand) {
      const key = command.input.Key!;
      mockS3Store.delete(key);
      return {};
    }

    return {};
  }),
};

// Mock Secrets Manager Client
export const mockSecretsManagerClient = {
  send: jest.fn(async (command: any) => {
    if (command instanceof GetSecretValueCommand) {
      const secretId = command.input.SecretId!;
      const secretValue = mockSecretsStore.get(secretId);
      if (!secretValue) {
        throw new Error('ResourceNotFoundException');
      }
      return { SecretString: secretValue };
    }
    return {};
  }),
};

// Apply mocks
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => mockDynamoDBClient),
  },
  GetCommand: jest.fn((input) => ({ input, constructor: GetCommand })),
  PutCommand: jest.fn((input) => ({ input, constructor: PutCommand })),
  UpdateCommand: jest.fn((input) => ({ input, constructor: UpdateCommand })),
  DeleteCommand: jest.fn((input) => ({ input, constructor: DeleteCommand })),
  QueryCommand: jest.fn((input) => ({ input, constructor: QueryCommand })),
  ScanCommand: jest.fn((input) => ({ input, constructor: ScanCommand })),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => mockS3Client),
  PutObjectCommand: jest.fn((input) => ({ input, constructor: PutObjectCommand })),
  GetObjectCommand: jest.fn((input) => ({ input, constructor: GetObjectCommand })),
  DeleteObjectCommand: jest.fn((input) => ({ input, constructor: DeleteObjectCommand })),
}));

jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn(() => mockSecretsManagerClient),
  GetSecretValueCommand: jest.fn((input) => ({ input, constructor: GetSecretValueCommand })),
}));

