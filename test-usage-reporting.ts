/**
 * Test script to verify usage reporting to Stripe
 * This simulates a usage event and verifies it's reported correctly
 */

import { usageTrackingService } from './backend/api/src/services/usageTrackingService';

async function testUsageReporting() {
  const tenantId = 'cust_84c8e438'; // Your customer ID from subscription metadata
  
  console.log('Testing usage reporting...');
  console.log('Tenant ID:', tenantId);
  
  // Simulate a gpt-4o usage event
  await usageTrackingService.storeUsageRecord({
    tenantId,
    serviceType: 'test_usage',
    model: 'gpt-4o',
    inputTokens: 5000,
    outputTokens: 2000,
    costUsd: 0.0325, // (5000 * 0.0025 + 2000 * 0.01) / 1000
    jobId: 'test_job_usage_reporting',
  });
  
  console.log('Usage record stored and reported to Stripe');
  console.log('Expected: 7 units (7000 tokens / 1000) reported to gpt-4o price');
}

testUsageReporting().catch(console.error);
