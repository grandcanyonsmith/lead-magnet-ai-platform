import { handler } from './src/index';
import { APIGatewayProxyEventV2, Context } from 'aws-lambda';

// Mock JWT claims for testing
const mockClaims = {
  sub: '84c8e438-0061-70f2-2ce0-7cb44989a329',
  'custom:tenant_id': '84c8e438-0061-70f2-2ce0-7cb44989a329',
  email: 'test@example.com',
};

// Mock context
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-local',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
  memoryLimitInMB: '2048',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test',
  logStreamName: '2024/01/01/[$LATEST]test',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

// Helper to create mock event
function createMockEvent(
  path: string,
  method: string,
  body?: any,
  queryParams?: Record<string, string>
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: queryParams ? new URLSearchParams(queryParams).toString() : '',
    headers: {
      'content-type': 'application/json',
    },
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method,
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
      requestId: 'test-request-id',
      routeKey: `${method} ${path}`,
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    } as any,
    pathParameters: {},
    queryStringParameters: queryParams || undefined,
    body: body ? JSON.stringify(body) : undefined,
    isBase64Encoded: false,
    authorizer: {
      jwt: {
        claims: mockClaims,
        scopes: [],
      },
    } as any,
  } as APIGatewayProxyEventV2;
}

// Test function
async function testEndpoint(name: string, path: string, method: string, body?: any, queryParams?: Record<string, string>) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log(`${method} ${path}`);
  console.log('='.repeat(60));
  
  const event = createMockEvent(path, method, body, queryParams);
  
  try {
    const result = await handler(event, mockContext);
    console.log('\n✅ Response Status:', result.statusCode);
    console.log('Response Headers:', JSON.stringify(result.headers, null, 2));
    
    if (result.body) {
      try {
        const parsedBody = JSON.parse(result.body);
        console.log('Response Body:', JSON.stringify(parsedBody, null, 2));
      } catch (e) {
        console.log('Response Body (raw):', result.body.substring(0, 500));
      }
    }
    
    return result;
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Local API Tests\n');
  
  // Test 1: Get workflows list
  await testEndpoint('Get Workflows List', '/admin/workflows', 'GET');
  
  // Test 2: Get analytics
  await testEndpoint('Get Analytics', '/admin/analytics', 'GET', undefined, { days: '30' });
  
  // Test 3: Generate workflow with AI
  await testEndpoint(
    'Generate Workflow with AI',
    '/admin/workflows/generate-with-ai',
    'POST',
    { description: 'test workflow', model: 'gpt-5' }
  );
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed');
  console.log('='.repeat(60));
}

// Run if executed directly
if (require.main === module) {
  runTests().catch((error) => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

export { testEndpoint, createMockEvent, mockContext };

