/**
 * Create external accounts in the database
 * Handles accounts from external systems (webhooks, integrations, etc.)
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const ARTIFACTS_BUCKET = process.env.ARTIFACTS_BUCKET || 'leadmagnet-artifacts-471112574622';

const client = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client({ region: AWS_REGION });

const USERS_TABLE = 'leadmagnet-users';
const CUSTOMERS_TABLE = 'leadmagnet-customers';

interface AccountData {
  userId?: string;
  customerId: string;
  email?: string;
  name?: string;
  phone?: string;
  companyName?: string;
  locationName?: string;
  timezone?: string;
  metadata?: Record<string, any>;
}

async function createCustomer(customerId: string, data: AccountData): Promise<void> {
  // Check if customer already exists
  const existing = await docClient.send(new QueryCommand({
    TableName: CUSTOMERS_TABLE,
    KeyConditionExpression: 'customer_id = :cid',
    ExpressionAttributeValues: { ':cid': customerId },
    Limit: 1,
  }));

  if (existing.Items && existing.Items.length > 0) {
    console.log(`  - Customer already exists: ${customerId}`);
    return;
  }

  // Create customer record
  const now = new Date().toISOString();
  await docClient.send(new PutCommand({
    TableName: CUSTOMERS_TABLE,
    Item: {
      customer_id: customerId,
      name: data.companyName || data.locationName || data.name || `Customer ${customerId}`,
      email: data.email || '',
      phone: data.phone || '',
      timezone: data.timezone || '',
      metadata: data.metadata || {},
      created_at: now,
      updated_at: now,
    },
  }));

  console.log(`  ✓ Created customer: ${customerId} (${data.companyName || data.locationName || data.name || 'Unknown'})`);

  // Create S3 folder
  const folderKey = `customers/${customerId}/.folder`;
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: ARTIFACTS_BUCKET,
      Key: folderKey,
    }));
    console.log(`  - S3 folder already exists: customers/${customerId}/`);
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      await s3Client.send(new PutObjectCommand({
        Bucket: ARTIFACTS_BUCKET,
        Key: folderKey,
        Body: Buffer.from(''),
        ContentType: 'application/x-directory',
      }));
      console.log(`  ✓ Created S3 folder: customers/${customerId}/`);
    } else {
      console.error(`  ✗ Error creating S3 folder for ${customerId}:`, error);
    }
  }
}

async function createUser(userId: string, customerId: string, data: AccountData): Promise<void> {
  // Check if user already exists
  const existing = await docClient.send(new QueryCommand({
    TableName: USERS_TABLE,
    KeyConditionExpression: 'user_id = :uid',
    ExpressionAttributeValues: { ':uid': userId },
    Limit: 1,
  }));

  if (existing.Items && existing.Items.length > 0) {
    console.log(`  - User already exists: ${userId}`);
    return;
  }

  // Create user record
  const now = new Date().toISOString();
  await docClient.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: {
      user_id: userId,
      customer_id: customerId,
      email: data.email || '',
      name: data.name || data.locationName || data.companyName || 'Unknown User',
      phone: data.phone || '',
      role: 'USER',
      created_at: now,
      updated_at: now,
    },
  }));

  console.log(`  ✓ Created user: ${userId} (${data.email || 'no email'}) -> customer: ${customerId}`);
}

async function createAccounts() {
  console.log('Creating external accounts in the database...\n');

  // Account 1: CC360 Test Account
  console.log('Account 1: CC360 Test Account');
  const account1CustomerId = '6kMPRAENXZaGJWeW5zxa'; // Using companyId as customer_id
  await createCustomer(account1CustomerId, {
    customerId: account1CustomerId,
    companyName: 'CC360 Test Account',
    metadata: {
      locationId: 'xxL6tWuwIRMdpVJvUAX5',
      accountId: account1CustomerId,
      installType: 'Location',
    },
  });

  const account1UserId = '0pvD8C46TbwnjNQfbodb';
  await createUser(account1UserId, account1CustomerId, {
    customerId: account1CustomerId,
    companyName: 'CC360 Test Account',
  });

  // Account 2: Abdallah Usama's Account
  console.log('\nAccount 2: Abdallah Usama\'s Account');
  const account2CustomerId = 'Cbjwl9dRdmiskYlzh8Oo'; // Using companyId/accountId as customer_id
  await createCustomer(account2CustomerId, {
    customerId: account2CustomerId,
    companyName: 'Abdallah Usama\'s Account',
    locationName: 'Abdallah Usama\'s Account',
    email: 'win@abdallahusama.com',
    phone: '+201503885559',
    timezone: 'America/Los_Angeles',
    metadata: {
      id: 'cmhxdhpfn000fl504i0unhczc',
      locationId: '3tGwxbab7olIwYWGjAxc',
      accountId: account2CustomerId,
      firstAccessedAt: '2025-11-13T11:55:54.755Z',
      lastAccessedAt: '2025-11-13T22:31:22.448Z',
      isActive: true,
      website: '',
    },
  });

  // Create user for account 2 (using email to generate user_id if needed)
  // Since we don't have a userId from the payload, we'll use the email as identifier
  // In a real scenario, you'd get this from Cognito or generate it
  const account2UserId = 'cmhxdhpfn000fl504i0unhczc'; // Using the id field as userId
  await createUser(account2UserId, account2CustomerId, {
    customerId: account2CustomerId,
    email: 'win@abdallahusama.com',
    name: 'Abdallah Usama',
    phone: '+201503885559',
    locationName: 'Abdallah Usama\'s Account',
  });

  console.log('\n✅ Account creation complete!');
}

createAccounts().catch(console.error);

