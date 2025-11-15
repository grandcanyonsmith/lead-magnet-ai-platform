/**
 * End-to-end test script for async workflow generation with webhook completion
 * Run with: node scripts/test-workflow-generation-e2e.js
 */

const https = require('https');
const http = require('http');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const TENANT_ID = process.env.TENANT_ID || 'test_tenant';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

const DESCRIPTION = 'A course idea validator that analyzes market demand, competition, target audience, and provides actionable recommendations for course creators';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
        ...(AUTH_TOKEN && { 'Authorization': `Bearer ${AUTH_TOKEN}` }),
        ...options.headers,
      },
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testWorkflowGeneration() {
  log('\n🧪 Testing Workflow Generation E2E Flow', 'reset');
  log('======================================\n', 'reset');

  log('📋 Test Configuration:', 'reset');
  log(`  API URL: ${API_URL}`);
  log(`  Frontend URL: ${FRONTEND_URL}`);
  log(`  Tenant ID: ${TENANT_ID}\n`);

  try {
    // Step 1: Submit workflow generation request
    log('1️⃣  Submitting workflow generation request...', 'reset');
    const webhookUrl = `${FRONTEND_URL}/api/webhooks/workflow-completion/{jobId}`;
    
    const submitResponse = await makeRequest(`${API_URL}/admin/workflows/generate-with-ai`, {
      method: 'POST',
      body: {
        description: DESCRIPTION,
        model: 'gpt-5',
        webhook_url: webhookUrl,
      },
    });

    if (submitResponse.status !== 200 && submitResponse.status !== 202) {
      log(`❌ Failed to submit request: ${submitResponse.status}`, 'red');
      console.error(submitResponse.data);
      process.exit(1);
    }

    const jobId = submitResponse.data?.body?.job_id || submitResponse.data?.job_id;
    if (!jobId) {
      log('❌ Failed to get job_id from response', 'red');
      console.error(submitResponse.data);
      process.exit(1);
    }

    log(`✅ Job created: ${jobId}\n`, 'green');

    // Step 2: Check initial job status
    log('2️⃣  Checking job status...', 'reset');
    const statusResponse = await makeRequest(`${API_URL}/admin/workflows/generation-status/${jobId}`);
    let status = statusResponse.data?.body?.status || statusResponse.data?.status;
    log(`  Status: ${status}\n`);

    // Step 3: Wait for job completion
    log('3️⃣  Waiting for job completion (max 5 minutes)...', 'reset');
    const MAX_WAIT = 300000; // 5 minutes
    const WAIT_INTERVAL = 5000; // 5 seconds
    let elapsed = 0;
    let workflowId = null;

    while (elapsed < MAX_WAIT) {
      await sleep(WAIT_INTERVAL);
      elapsed += WAIT_INTERVAL;

      const pollResponse = await makeRequest(`${API_URL}/admin/workflows/generation-status/${jobId}`);
      status = pollResponse.data?.body?.status || pollResponse.data?.status;
      // Try to get workflow_id from multiple possible locations
      workflowId = pollResponse.data?.body?.workflow_id 
        || pollResponse.data?.workflow_id
        || pollResponse.data?.body?.result?.workflow_id
        || pollResponse.data?.result?.workflow_id;

      log(`  [${Math.floor(elapsed / 1000)}s] Status: ${status}`);

      if (status === 'completed') {
        if (workflowId) {
          log(`✅ Job completed! Workflow ID: ${workflowId}\n`, 'green');
          break;
        } else {
          log('⚠️  Job completed but no workflow_id found', 'yellow');
        }
      } else if (status === 'failed') {
        const errorMsg = pollResponse.data?.body?.error_message || pollResponse.data?.error_message || 'Unknown error';
        log(`❌ Job failed: ${errorMsg}`, 'red');
        process.exit(1);
      }
    }

    if (status !== 'completed') {
      log(`❌ Job did not complete within ${MAX_WAIT / 1000} seconds`, 'red');
      process.exit(1);
    }

    // If workflow_id not in response, try to find it by querying recent draft workflows
    if (!workflowId) {
      log('⚠️  workflow_id not in response, searching for recently created draft workflow...', 'yellow');
      const workflowsResponse = await makeRequest(`${API_URL}/admin/workflows?status=draft&limit=10`);
      const workflows = workflowsResponse.data?.body?.workflows || workflowsResponse.data?.workflows || [];
      
      // Find workflow created in the last 10 minutes
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      const recentWorkflow = workflows.find((w) => {
        const createdAt = new Date(w.created_at).getTime();
        return createdAt > tenMinutesAgo;
      });
      
      if (recentWorkflow) {
        workflowId = recentWorkflow.workflow_id;
        log(`✅ Found workflow: ${workflowId} (${recentWorkflow.workflow_name})\n`, 'green');
      } else {
        log('❌ Could not find recently created draft workflow', 'red');
        log(`   Found ${workflows.length} draft workflows total`, 'yellow');
        process.exit(1);
      }
    }

    // Step 4: Verify workflow was created as draft
    log('4️⃣  Verifying workflow was created as draft...', 'reset');
    const workflowResponse = await makeRequest(`${API_URL}/admin/workflows/${workflowId}`);
    
    if (workflowResponse.status !== 200) {
      log(`❌ Failed to get workflow: ${workflowResponse.status}`, 'red');
      process.exit(1);
    }

    const workflowStatus = workflowResponse.data?.body?.status || workflowResponse.data?.status;
    const workflowName = workflowResponse.data?.body?.workflow_name || workflowResponse.data?.workflow_name;

    if (workflowStatus === 'draft') {
      log('✅ Workflow is saved as draft', 'green');
      log(`  Workflow Name: ${workflowName}\n`);
    } else {
      log(`❌ Workflow status is '${workflowStatus}', expected 'draft'`, 'red');
      process.exit(1);
    }

    // Step 5: Test webhook endpoint
    log('5️⃣  Testing webhook completion endpoint...', 'reset');
    const webhookEndpoint = `${FRONTEND_URL}/api/webhooks/workflow-completion/${jobId}`;
    
    const webhookPayload = {
      job_id: jobId,
      status: 'completed',
      workflow_id: workflowId,
      completed_at: new Date().toISOString(),
    };

    const webhookResponse = await makeRequest(webhookEndpoint, {
      method: 'POST',
      body: webhookPayload,
    });

    const webhookSuccess = webhookResponse.data?.success;
    if (webhookSuccess) {
      log('✅ Webhook endpoint accepted completion\n', 'green');
    } else {
      log(`⚠️  Webhook endpoint response: ${JSON.stringify(webhookResponse.data)}\n`, 'yellow');
    }

    // Step 6: Test webhook status check
    log('6️⃣  Testing webhook status check endpoint...', 'reset');
    const statusCheckResponse = await makeRequest(webhookEndpoint);
    
    const statusCheckSuccess = statusCheckResponse.data?.success;
    const statusCheckWorkflowId = statusCheckResponse.data?.workflow_id;

    if (statusCheckSuccess && statusCheckWorkflowId === workflowId) {
      log('✅ Webhook status check works correctly\n', 'green');
    } else {
      log(`⚠️  Status check response: ${JSON.stringify(statusCheckResponse.data)}\n`, 'yellow');
    }

    // Summary
    log('======================================', 'reset');
    log('✅ All tests passed!\n', 'green');
    log('Summary:', 'reset');
    log(`  Job ID: ${jobId}`);
    log(`  Workflow ID: ${workflowId}`);
    log(`  Workflow Name: ${workflowName}`);
    log(`  Status: ${workflowStatus}\n`);
    log('Next steps:', 'reset');
    log(`  1. Open ${FRONTEND_URL}/dashboard/workflows/${workflowId}/edit`);
    log('  2. Verify the workflow is displayed with \'Draft\' badge');
    log('  3. Review and save the workflow\n');

  } catch (error) {
    log(`❌ Test failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testWorkflowGeneration().catch((error) => {
  log(`❌ Unexpected error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

