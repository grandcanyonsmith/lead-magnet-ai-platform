#!/usr/bin/env ts-node

/**
 * Test script to generate usage and verify it's reported to Stripe
 * Run with: npx ts-node test-usage-report.ts
 */

// Set environment variables before importing modules
process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'info';
process.env.USAGE_RECORDS_TABLE = process.env.USAGE_RECORDS_TABLE || 'leadmagnet-usage-records';
process.env.CUSTOMERS_TABLE = process.env.CUSTOMERS_TABLE || 'leadmagnet-customers';
process.env.STRIPE_SECRET_NAME = process.env.STRIPE_SECRET_NAME || 'leadmagnet/stripe-api-key';
process.env.STRIPE_METERED_PRICE_MAP = process.env.STRIPE_METERED_PRICE_MAP || '{"gpt-5":"price_1SbrjKBnnqL8bKFQNgo11qNc","gpt-4.1":"price_1SbrjZBnnqL8bKFQhn8HqWC9","gpt-4o":"price_1SbrjgBnnqL8bKFQX2wtPXum","gpt-4-turbo":"price_1SbrjoBnnqL8bKFQQvG1S3BU","gpt-3.5-turbo":"price_1SbrjyBnnqL8bKFQ2YAQdVFE","gpt-4o-mini":"price_1Sbrk8BnnqL8bKFQS8sl13Ju","computer-use-preview":"price_1SbrkGBnnqL8bKFQ9i8XIKlJ","o4-mini-deep-research":"price_1SbrkPBnnqL8bKFQwIwnOO0F"}';
process.env.STRIPE_METERED_PRICE_ID = process.env.STRIPE_METERED_PRICE_ID || 'price_1SbrjgBnnqL8bKFQX2wtPXum';

import { usageTrackingService } from './backend/api/src/services/usageTrackingService';

async function testUsageReporting() {
  const tenantId = 'cust_84c8e438'; // Your customer ID
  
  console.log('🧪 Testing usage reporting to Stripe...');
  console.log('Tenant ID:', tenantId);
  console.log('Model: gpt-4o');
  console.log('Tokens: 5000 input + 2000 output = 7000 total');
  console.log('Expected units: 7 (7000 / 1000)');
  console.log('');
  
  try {
    // Simulate a gpt-4o usage event
    await usageTrackingService.storeUsageRecord({
      tenantId,
      serviceType: 'test_usage_reporting',
      model: 'gpt-4o',
      inputTokens: 5000,
      outputTokens: 2000,
      costUsd: 0.0325, // (5000 * 0.0025 + 2000 * 0.01) / 1000
      jobId: 'test_job_usage_reporting_' + Date.now(),
    });
    
    console.log('✅ Usage record stored in DynamoDB');
    console.log('✅ Usage reported to Stripe');
    console.log('');
    console.log('📊 Next steps:');
    console.log('1. Check Stripe Dashboard → Subscriptions → Usage');
    console.log('2. Check app UI → Settings → Billing & Usage');
    console.log('3. Check CloudWatch logs for detailed reporting logs');
    console.log('');
    console.log('💡 Expected: 7 units (7k tokens) should appear in Stripe for gpt-4o price');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testUsageReporting().catch(console.error);
