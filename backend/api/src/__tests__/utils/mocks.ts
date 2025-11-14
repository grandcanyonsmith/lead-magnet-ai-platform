/**
 * Mock utilities for testing
 */

import { APIGatewayProxyEventV2 } from 'aws-lambda';

/**
 * Create a mock API Gateway event
 */
export function createMockEvent(
  overrides: Partial<APIGatewayProxyEventV2> = {}
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'GET /test',
    rawPath: '/test',
    rawQueryString: '',
    headers: {
      'content-type': 'application/json',
      ...overrides.headers,
    },
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      domainName: 'test.example.com',
      domainPrefix: 'test',
      http: {
        method: 'GET',
        path: '/test',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'jest-test',
      },
      requestId: 'test-request-id',
      routeKey: 'GET /test',
      stage: 'test',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: Date.now(),
    },
    isBase64Encoded: false,
    ...overrides,
  };
}

/**
 * Create a mock authenticated event with JWT claims
 */
export function createMockAuthenticatedEvent(
  userId: string = 'test-user-id',
  customerId: string = 'test-customer-id',
  role: string = 'USER',
  overrides: Partial<APIGatewayProxyEventV2> = {}
): APIGatewayProxyEventV2 {
  const event = createMockEvent(overrides);
  (event.requestContext as any).authorizer = {
    jwt: {
      claims: {
        sub: userId,
        'custom:customer_id': customerId,
        'custom:role': role,
        email: 'test@example.com',
      },
    },
  };
  return event;
}

/**
 * Create a mock DynamoDB item
 */
export function createMockDynamoDBItem<T extends Record<string, any>>(
  base: T,
  overrides: Partial<T> = {}
): T {
  return {
    ...base,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mock DynamoDB service responses
 */
export const mockDynamoDBResponses = {
  get: {
    success: (item: any) => ({ Item: item }),
    notFound: () => ({ Item: undefined }),
  },
  put: {
    success: () => ({}),
  },
  update: {
    success: (attributes: any) => ({ Attributes: attributes }),
  },
  query: {
    success: (items: any[]) => ({
      Items: items,
      LastEvaluatedKey: undefined,
    }),
    paginated: (items: any[], lastKey?: any) => ({
      Items: items,
      LastEvaluatedKey: lastKey,
    }),
  },
  scan: {
    success: (items: any[]) => ({ Items: items }),
  },
};

/**
 * Mock S3 service responses
 */
export const mockS3Responses = {
  putObject: {
    success: () => ({}),
  },
  getObject: {
    success: (buffer: Buffer, contentType: string = 'application/octet-stream') => ({
      Body: buffer,
      ContentType: contentType,
    }),
    notFound: () => {
      throw new Error('NoSuchKey');
    },
  },
  deleteObject: {
    success: () => ({}),
  },
};

/**
 * Create mock context for Lambda handler
 */
export function createMockContext(overrides: any = {}) {
  return {
    awsRequestId: 'test-request-id',
    functionName: 'test-function',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
    memoryLimitInMB: '128',
    logGroupName: '/aws/lambda/test',
    logStreamName: '2024/01/01/[$LATEST]test',
    getRemainingTimeInMillis: () => 30000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
    ...overrides,
  };
}

