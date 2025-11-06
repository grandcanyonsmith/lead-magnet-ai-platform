#!/usr/bin/env node

/**
 * Manual workflow generation job processor
 * Use this to process stuck workflow generation jobs
 * 
 * Usage: node scripts/process-workflow-job.js <job_id>
 */

const { handler } = require('../backend/api/dist/index');

const jobId = process.argv[2];

if (!jobId) {
  console.error('Usage: node scripts/process-workflow-job.js <job_id>');
  console.error('Example: node scripts/process-workflow-job.js wfgen_01K9CS4S0S6HRYBVPEPW5ZDP6K');
  process.exit(1);
}

// Set environment variables
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

// Mock context
const mockContext = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'manual-job-processor',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:manual-processor',
  memoryLimitInMB: '2048',
  awsRequestId: `manual-${Date.now()}`,
  logGroupName: '/aws/lambda/manual-processor',
  logStreamName: 'manual',
  getRemainingTimeInMillis: () => 300000, // 5 minutes
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

// Create async event
const event = {
  source: 'workflow-generation-job',
  job_id: jobId,
  tenant_id: '84c8e438-0061-70f2-2ce0-7cb44989a329', // Default tenant, update if needed
  description: '', // Will be loaded from job
  model: 'gpt-5',
};

async function processJob() {
  console.log(`🚀 Processing workflow generation job: ${jobId}`);
  console.log('='.repeat(60));
  
  try {
    const result = await handler(event, mockContext);
    console.log('\n✅ Job processed successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('\n❌ Error processing job:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

processJob();

