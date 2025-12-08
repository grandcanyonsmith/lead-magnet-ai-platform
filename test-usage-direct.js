#!/usr/bin/env node

/**
 * Direct test of usage reporting using AWS SDK
 * This bypasses the Lambda and directly tests the Stripe reporting
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const Stripe = require('stripe');
const { ulid } = require('ulid');

const AWS_REGION = 'us-east-1';
const TENANT_ID = 'cust_84c8e438';
const STRIPE_CUSTOMER_ID = 'cus_TYz3TewHBVzzU3';
const STRIPE_SUBSCRIPTION_ID = 'sub_1Sbr9eBnnqL8bKFQOJWi9i1r';

const METERED_PRICE_MAP = {
  'gpt-5': 'price_1SbrjKBnnqL8bKFQNgo11qNc',
  'gpt-4.1': 'price_1SbrjZBnnqL8bKFQhn8HqWC9',
  'gpt-4o': 'price_1SbrjgBnnqL8bKFQX2wtPXum',
  'gpt-4-turbo': 'price_1SbrjoBnnqL8bKFQQvG1S3BU',
  'gpt-3.5-turbo': 'price_1SbrjyBnnqL8bKFQ2YAQdVFE',
  'gpt-4o-mini': 'price_1Sbrk8BnnqL8bKFQS8sl13Ju',
  'computer-use-preview': 'price_1SbrkGBnnqL8bKFQ9i8XIKlJ',
  'o4-mini-deep-research': 'price_1SbrkPBnnqL8bKFQwIwnOO0F'
};

async function getStripeClient() {
  const secretsClient = new SecretsManagerClient({ region: AWS_REGION });
  const secretResponse = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: 'leadmagnet/stripe-api-key' })
  );
  // Stripe key might be stored as plain string or JSON
  let stripeKey = secretResponse.SecretString;
  try {
    stripeKey = JSON.parse(stripeKey);
  } catch (e) {
    // Already a string, use as-is
  }
  return new Stripe(stripeKey, { apiVersion: '2023-10-16' });
}

function normalizeModelName(model) {
  const normalized = model.toLowerCase().trim();
  if (normalized.startsWith('gpt-5')) return 'gpt-5';
  if (normalized.startsWith('gpt-4.1')) return 'gpt-4.1';
  if (normalized.startsWith('gpt-4o-mini')) return 'gpt-4o-mini';
  if (normalized.startsWith('gpt-4o')) return 'gpt-4o';
  if (normalized.startsWith('gpt-4-turbo')) return 'gpt-4-turbo';
  if (normalized.startsWith('gpt-3.5-turbo')) return 'gpt-3.5-turbo';
  if (normalized.startsWith('computer-use-preview')) return 'computer-use-preview';
  if (normalized.includes('o4-mini-deep-research')) return 'o4-mini-deep-research';
  return normalized;
}

async function testUsageReporting() {
  console.log('🧪 Testing usage reporting to Stripe...');
  console.log('Tenant ID:', TENANT_ID);
  console.log('Model: gpt-4o');
  console.log('Tokens: 5000 input + 2000 output = 7000 total');
  console.log('Expected units: 7 (7000 / 1000)');
  console.log('');

  const dbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));
  const stripe = await getStripeClient();

  const usageId = `usage_${ulid()}`;
  const model = 'gpt-4o';
  const inputTokens = 5000;
  const outputTokens = 2000;
  const costUsd = 0.0325;
  const usageTokens = inputTokens + outputTokens;
  const usageUnits = Math.ceil(usageTokens / 1000);

  // 1. Store usage record in DynamoDB
  console.log('📝 Step 1: Storing usage record in DynamoDB...');
  await dbClient.send(new PutCommand({
    TableName: 'leadmagnet-usage-records',
    Item: {
      usage_id: usageId,
      tenant_id: TENANT_ID,
      job_id: 'test_job_' + Date.now(),
      service_type: 'test_usage_reporting',
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      created_at: new Date().toISOString(),
    }
  }));
  console.log('✅ Usage record stored:', usageId);

  // 2. Get customer record
  console.log('📝 Step 2: Getting customer record...');
  const customerResult = await dbClient.send(new GetCommand({
    TableName: 'leadmagnet-customers',
    Key: { customer_id: TENANT_ID }
  }));
  
  if (!customerResult.Item || !customerResult.Item.stripe_customer_id) {
    throw new Error('Customer not found or missing Stripe ID');
  }
  console.log('✅ Customer found:', customerResult.Item.stripe_customer_id);

  // 3. Get subscription
  console.log('📝 Step 3: Getting Stripe subscription...');
  const subscription = await stripe.subscriptions.retrieve(STRIPE_SUBSCRIPTION_ID);
  console.log('✅ Subscription found:', subscription.id, 'Status:', subscription.status);

  // 4. Find metered item
  console.log('📝 Step 4: Finding metered subscription item...');
  const normalizedModel = normalizeModelName(model);
  const targetPriceId = METERED_PRICE_MAP[normalizedModel] || METERED_PRICE_MAP['gpt-4o'];
  
  const meteredItem = subscription.items.data.find(
    item => item.price.id === targetPriceId
  );

  if (!meteredItem) {
    console.error('❌ No metered item found for model:', normalizedModel, 'price:', targetPriceId);
    console.log('Available items:', subscription.items.data.map(i => ({ id: i.id, priceId: i.price.id })));
    throw new Error('Metered item not found');
  }
  console.log('✅ Found metered item:', meteredItem.id, 'for price:', targetPriceId);

  // 5. Report usage to Stripe
  console.log('📝 Step 5: Reporting usage to Stripe...');
  const reportedAt = Math.floor(Date.now() / 1000);
  
  const usageRecord = await stripe.subscriptionItems.createUsageRecord(
    meteredItem.id,
    {
      quantity: usageUnits,
      timestamp: reportedAt,
      action: 'increment',
    },
    {
      idempotencyKey: `${usageId}:inc`,
    }
  );
  console.log('✅ Usage reported to Stripe:', usageRecord.id, 'Quantity:', usageRecord.quantity);

  // 6. Update customer record
  console.log('📝 Step 6: Updating customer record...');
  const currentPeriodTokens = customerResult.Item.current_period_tokens || 0;
  const currentPeriodCostUsd = customerResult.Item.current_period_cost_usd || 0;
  const newTotalTokens = currentPeriodTokens + usageTokens;
  const newTotalCostUsd = currentPeriodCostUsd + costUsd;
  const today = new Date().toISOString().split('T')[0];

  await dbClient.send(new PutCommand({
    TableName: 'leadmagnet-customers',
    Item: {
      ...customerResult.Item,
      current_period_usage: newTotalCostUsd * 2,
      current_period_tokens: newTotalTokens,
      current_period_cost_usd: newTotalCostUsd,
      current_period_upcharge_usd: newTotalCostUsd * 2,
      last_usage_set_date: today,
      updated_at: new Date().toISOString(),
    }
  }));
  console.log('✅ Customer record updated');
  console.log('   New total tokens:', newTotalTokens);
  console.log('   New total cost: $' + newTotalCostUsd.toFixed(6));

  console.log('');
  console.log('✅ Test completed successfully!');
  console.log('');
  console.log('📊 Verification steps:');
  console.log('1. Check Stripe Dashboard → Subscriptions →', STRIPE_SUBSCRIPTION_ID, '→ Usage');
  console.log('2. Check app UI → Settings → Billing & Usage');
  console.log('3. Expected: 7 units (7k tokens) for gpt-4o');
}

testUsageReporting().catch(error => {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
