import { handler } from './src/index';
import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { db } from './src/utils/db';
import { generateWebhookToken } from './src/utils/webhookToken';

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

// Helper to create mock event (without auth for public webhook endpoint)
function createMockWebhookEvent(
  path: string,
  method: string,
  body?: any
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: '',
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
    queryStringParameters: undefined,
    body: body ? JSON.stringify(body) : undefined,
    isBase64Encoded: false,
    // No authorizer for public webhook endpoint
  } as APIGatewayProxyEventV2;
}

// Helper to create mock event with auth (for admin endpoints)
function createMockAuthEvent(
  path: string,
  method: string,
  body?: any
): APIGatewayProxyEventV2 {
  return {
    ...createMockWebhookEvent(path, method, body),
    authorizer: {
      jwt: {
        claims: mockClaims,
        scopes: [],
      },
    } as any,
  } as APIGatewayProxyEventV2;
}

// Test function
async function testEndpoint(name: string, event: APIGatewayProxyEventV2) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log(`${event.requestContext.http.method} ${event.rawPath}`);
  if (event.body) {
    try {
      const body = JSON.parse(event.body);
      console.log('Request Body:', JSON.stringify(body, null, 2));
    } catch (e) {
      console.log('Request Body:', event.body.substring(0, 200));
    }
  }
  console.log('='.repeat(60));
  
  try {
    const result = await handler(event, mockContext);
    console.log('\n✅ Response Status:', result.statusCode);
    
    if (result.body) {
      try {
        const parsedBody = JSON.parse(result.body);
        console.log('Response Body:', JSON.stringify(parsedBody, null, 2));
        return parsedBody;
      } catch (e) {
        console.log('Response Body (raw):', result.body.substring(0, 500));
        return result.body;
      }
    }
    
    return null;
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
    throw error;
  }
}

// Run webhook tests
async function runWebhookTests() {
  console.log('🚀 Starting Webhook Tests\n');
  
  const USER_SETTINGS_TABLE = process.env.USER_SETTINGS_TABLE || 'leadmagnet-user-settings';
  const tenantId = mockClaims['custom:tenant_id'];
  
  // Setup: Ensure user has a webhook token
  console.log('📋 Setup: Ensuring webhook token exists...');
  let settings = await db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId });
  
  if (!settings) {
    console.log('Creating new settings...');
    settings = {
      tenant_id: tenantId,
      webhook_token: generateWebhookToken(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.put(USER_SETTINGS_TABLE, settings);
  } else if (!settings.webhook_token) {
    console.log('Generating webhook token...');
    settings.webhook_token = generateWebhookToken();
    await db.update(USER_SETTINGS_TABLE, { tenant_id: tenantId }, {
      webhook_token: settings.webhook_token,
      updated_at: new Date().toISOString(),
    });
  }
  
  const webhookToken = settings.webhook_token;
  console.log(`✓ Webhook token: ${webhookToken.substring(0, 20)}...`);
  console.log('');
  
  // Test 1: Get webhook URL from settings
  console.log('📋 Test 1: Get webhook URL from settings');
  const settingsResponse = await testEndpoint(
    'Get Webhook URL',
    createMockAuthEvent('/admin/settings/webhook', 'GET')
  );
  
  if (settingsResponse?.webhook_url) {
    console.log(`✓ Webhook URL retrieved: ${settingsResponse.webhook_url}`);
  }
  console.log('');
  
  // Test 2: Test webhook with workflow_id
  console.log('📋 Test 2: POST to webhook with workflow_id');
  const webhookResponse1 = await testEndpoint(
    'Webhook with workflow_id',
    createMockWebhookEvent(
      `/v1/webhooks/${webhookToken}`,
      'POST',
      {
        workflow_id: 'wf_test001',
        form_data: {
          name: 'Webhook Test User',
          email: 'webhook@test.com',
          phone: '+14155551234',
          custom_field: 'Test value from webhook',
        },
      }
    )
  );
  
  if (webhookResponse1?.job_id) {
    console.log(`✓ Job created: ${webhookResponse1.job_id}`);
  }
  console.log('');
  
  // Test 3: Test webhook with workflow_name
  console.log('📋 Test 3: POST to webhook with workflow_name');
  const webhookResponse2 = await testEndpoint(
    'Webhook with workflow_name',
    createMockWebhookEvent(
      `/v1/webhooks/${webhookToken}`,
      'POST',
      {
        workflow_name: 'Test Workflow',
        form_data: {
          name: 'Webhook Test User 2',
          email: 'webhook2@test.com',
          phone: '+14155551235',
          custom_field: 'Test value with workflow_name',
        },
      }
    )
  );
  
  if (webhookResponse2?.job_id) {
    console.log(`✓ Job created: ${webhookResponse2.job_id}`);
  }
  console.log('');
  
  // Test 4: Test invalid token
  console.log('📋 Test 4: Test invalid webhook token');
  try {
    await testEndpoint(
      'Invalid Token',
      createMockWebhookEvent(
        '/v1/webhooks/invalid_token_12345',
        'POST',
        {
          workflow_id: 'wf_test001',
          form_data: {
            name: 'Test',
            email: 'test@test.com',
            phone: '+14155551234',
          },
        }
      )
    );
  } catch (error: any) {
    if (error.message?.includes('404') || error.message?.includes('Invalid webhook token')) {
      console.log('✓ Invalid token correctly rejected');
    } else {
      throw error;
    }
  }
  console.log('');
  
  // Test 5: Test missing workflow identifier
  console.log('📋 Test 5: Test missing workflow identifier');
  try {
    await testEndpoint(
      'Missing Workflow ID',
      createMockWebhookEvent(
        `/v1/webhooks/${webhookToken}`,
        'POST',
        {
          form_data: {
            name: 'Test',
            email: 'test@test.com',
            phone: '+14155551234',
          },
        }
      )
    );
  } catch (error: any) {
    if (error.message?.includes('400') || error.message?.includes('workflow_id') || error.message?.includes('workflow_name')) {
      console.log('✓ Missing workflow identifier correctly rejected');
    } else {
      throw error;
    }
  }
  console.log('');
  
  // Test 6: Regenerate webhook token
  console.log('📋 Test 6: Regenerate webhook token');
  const regenerateResponse = await testEndpoint(
    'Regenerate Webhook Token',
    createMockAuthEvent('/admin/settings/webhook/regenerate', 'POST')
  );
  
  if (regenerateResponse?.webhook_url) {
    console.log(`✓ New webhook URL: ${regenerateResponse.webhook_url}`);
    const newToken = regenerateResponse.webhook_url.split('/').pop();
    if (newToken && newToken !== webhookToken) {
      console.log('✓ Token was regenerated (different from original)');
    }
  }
  console.log('');
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ All webhook tests completed');
  console.log('='.repeat(60));
}

// Run if executed directly
if (require.main === module) {
  runWebhookTests().catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
}

export { testEndpoint, createMockWebhookEvent, createMockAuthEvent };

