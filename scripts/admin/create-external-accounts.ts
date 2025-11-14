/**
 * Create external accounts in the database
 * Handles accounts from external systems (webhooks, integrations, etc.)
 */
import {
  getDynamoDbDocumentClient,
  getS3Client,
  getTableName,
  getAwsRegion,
  getArtifactsBucket,
  printSuccess,
  printError,
  printWarning,
  printInfo,
  printSection,
} from '../lib/common';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const docClient = getDynamoDbDocumentClient();
const s3Client = getS3Client();

const USERS_TABLE = getTableName('users');
const CUSTOMERS_TABLE = getTableName('customers');

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
    printInfo(`Customer already exists: ${customerId}`);
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

  printSuccess(`Created customer: ${customerId} (${data.companyName || data.locationName || data.name || 'Unknown'})`);

  // Create S3 folder
  const folderKey = `customers/${customerId}/.folder`;
  try {
    const bucket = await getArtifactsBucket();
    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: bucket,
        Key: folderKey,
      }));
      printInfo(`S3 folder already exists: customers/${customerId}/`);
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        await s3Client.send(new PutObjectCommand({
          Bucket: bucket,
          Key: folderKey,
          Body: Buffer.from(''),
          ContentType: 'application/x-directory',
        }));
        printSuccess(`Created S3 folder: customers/${customerId}/`);
      } else {
        printError(`Error creating S3 folder for ${customerId}: ${error}`);
      }
    }
  } catch (error: any) {
    printError(`Error creating S3 folder for ${customerId}: ${error}`);
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
    printInfo(`User already exists: ${userId}`);
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

  printSuccess(`Created user: ${userId} (${data.email || 'no email'}) -> customer: ${customerId}`);
}

async function createAccounts() {
  printSection('Creating External Accounts');
  printInfo('Creating external accounts in the database...\n');

  // Account 1: CC360 Test Account
  printSection('Account 1: CC360 Test Account', 60);
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
  printSection('Account 2: Abdallah Usama\'s Account', 60);
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

  printSection('Account Creation Complete');
  printSuccess('All accounts created successfully!');
}

createAccounts().catch(console.error);

