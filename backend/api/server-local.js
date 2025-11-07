#!/usr/bin/env node

/**
 * Local development server for the API
 * Wraps the Lambda handler in an Express server for local development
 */

// Set environment variables FIRST, before importing any modules
// This ensures they're available when modules are loaded
process.env.WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || 'leadmagnet-workflows';
process.env.FORMS_TABLE = process.env.FORMS_TABLE || 'leadmagnet-forms';
process.env.SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE || 'leadmagnet-submissions';
process.env.JOBS_TABLE = process.env.JOBS_TABLE || 'leadmagnet-jobs';
process.env.ARTIFACTS_TABLE = process.env.ARTIFACTS_TABLE || 'leadmagnet-artifacts';
process.env.TEMPLATES_TABLE = process.env.TEMPLATES_TABLE || 'leadmagnet-templates';
process.env.USER_SETTINGS_TABLE = process.env.USER_SETTINGS_TABLE || 'leadmagnet-user-settings';
process.env.USAGE_RECORDS_TABLE = process.env.USAGE_RECORDS_TABLE || 'leadmagnet-usage-records';
process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'info';
process.env.OPENAI_SECRET_NAME = process.env.OPENAI_SECRET_NAME || 'leadmagnet/openai-api-key';
process.env.LAMBDA_FUNCTION_NAME = process.env.LAMBDA_FUNCTION_NAME || 'leadmagnet-api-handler';
process.env.AWS_ACCOUNT_ID = process.env.AWS_ACCOUNT_ID || '471112574622';
process.env.STEP_FUNCTIONS_ARN = process.env.STEP_FUNCTIONS_ARN || 'arn:aws:states:us-east-1:471112574622:stateMachine:leadmagnet-job-processor';
process.env.ARTIFACTS_BUCKET = process.env.ARTIFACTS_BUCKET || 'leadmagnet-artifacts-471112574622';

// Now import modules after environment variables are set
const express = require('express');
const cors = require('cors');
const { handler } = require('./dist/index');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mock JWT claims for local development
// In production, these come from API Gateway authorizer
const mockClaims = {
  sub: '84c8e438-0061-70f2-2ce0-7cb44989a329',
  'custom:tenant_id': '84c8e438-0061-70f2-2ce0-7cb44989a329',
  email: 'test@example.com',
};

// Create mock Lambda context (will be created per request)
function createMockContext() {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'local-dev-server',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:local-dev',
    memoryLimitInMB: '2048',
    awsRequestId: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    logGroupName: '/aws/lambda/local-dev',
    logStreamName: 'local',
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };
}

// Convert Express request to API Gateway event
function createApiGatewayEvent(req) {
  const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
  
  return {
    version: '2.0',
    routeKey: `${req.method} ${req.path}`,
    rawPath: req.path,
    rawQueryString: queryString,
    headers: {
      'content-type': req.headers['content-type'] || 'application/json',
      'authorization': req.headers['authorization'] || '',
      ...req.headers,
    },
    requestContext: {
      accountId: '123456789012',
      apiId: 'local-api',
      domainName: 'localhost',
      domainPrefix: 'localhost',
      http: {
        method: req.method,
        path: req.path,
        protocol: 'HTTP/1.1',
        sourceIp: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'local-dev',
      },
      requestId: `local-${Date.now()}`,
      routeKey: `${req.method} ${req.path}`,
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
      authorizer: {
        jwt: {
          claims: mockClaims,
          scopes: [],
        },
      },
    },
    pathParameters: req.params || {},
    queryStringParameters: queryString ? Object.fromEntries(new URLSearchParams(queryString)) : undefined,
    body: req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : undefined,
    isBase64Encoded: false,
  };
}

// Convert API Gateway response to Express response
function sendResponse(res, apiResponse) {
  // Set status code
  res.status(apiResponse.statusCode || 200);

  // Set headers
  if (apiResponse.headers) {
    Object.entries(apiResponse.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Parse and send body
  if (apiResponse.body) {
    try {
      const parsed = JSON.parse(apiResponse.body);
      res.json(parsed);
    } catch (e) {
      res.send(apiResponse.body);
    }
  } else {
    res.end();
  }
}

// Handle all routes
app.all('*', async (req, res) => {
  const context = createMockContext();
  try {
    console.log(`[Local Server] ${req.method} ${req.path} [${context.awsRequestId}]`);
    
    const event = createApiGatewayEvent(req);
    const result = await handler(event, context);
    
    sendResponse(res, result);
  } catch (error) {
    console.error(`[Local Server] Error [${context.awsRequestId}]:`, error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Start server with error handling for port conflicts
const server = app.listen(PORT, () => {
  console.log(`🚀 Local API server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 AWS Region: ${process.env.AWS_REGION}`);
  console.log(`\n💡 Make sure AWS credentials are configured for DynamoDB access`);
  console.log(`💡 Frontend should point to: http://localhost:${PORT}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error(`💡 Try one of these solutions:`);
    console.error(`   1. Kill the process using port ${PORT}: lsof -ti:${PORT} | xargs kill -9`);
    console.error(`   2. Use a different port: PORT=3002 npm run dev`);
    console.error(`   3. Find what's using the port: lsof -i:${PORT}\n`);
    process.exit(1);
  } else {
    console.error(`\n❌ Server error:`, err);
    console.error(`💡 Error details:`, err.message);
    if (err.stack) {
      console.error(`\nStack trace:`, err.stack);
    }
    process.exit(1);
  }
});

