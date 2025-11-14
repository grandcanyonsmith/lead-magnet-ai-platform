/**
 * Migration script to convert tenant_id to customerId structure
 * 
 * This script:
 * 1. Migrates Cognito users to Users table
 * 2. Creates Customer records for each unique tenant_id
 * 3. Creates User records for existing users
 * 4. Updates existing records to include customer_id
 * 5. Creates S3 folders (prefixes) for each customer
 * 
 * Usage:
 *   USER_POOL_ID=us-east-1_xxx ARTIFACTS_BUCKET=leadmagnet-artifacts-xxx ts-node scripts/migrate-tenant-to-customer.ts
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, ListUsersCommand, AdminUpdateUserAttributesCommand, AttributeType } from '@aws-sdk/client-cognito-identity-provider';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const USER_POOL_ID = process.env.USER_POOL_ID || '';
const ARTIFACTS_BUCKET = process.env.ARTIFACTS_BUCKET || '';

const client = new DynamoDBClient({
  region: AWS_REGION,
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

const cognitoClient = new CognitoIdentityProviderClient({
  region: AWS_REGION,
});

const s3Client = new S3Client({
  region: AWS_REGION,
});

// Table names
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || 'leadmagnet-workflows';
const FORMS_TABLE = process.env.FORMS_TABLE || 'leadmagnet-forms';
const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE || 'leadmagnet-submissions';
const JOBS_TABLE = process.env.JOBS_TABLE || 'leadmagnet-jobs';
const ARTIFACTS_TABLE = process.env.ARTIFACTS_TABLE || 'leadmagnet-artifacts';
const TEMPLATES_TABLE = process.env.TEMPLATES_TABLE || 'leadmagnet-templates';
const USER_SETTINGS_TABLE = process.env.USER_SETTINGS_TABLE || 'leadmagnet-user-settings';
const NOTIFICATIONS_TABLE = process.env.NOTIFICATIONS_TABLE || 'leadmagnet-notifications';
const USERS_TABLE = process.env.USERS_TABLE || 'leadmagnet-users';
const CUSTOMERS_TABLE = process.env.CUSTOMERS_TABLE || 'leadmagnet-customers';

/**
 * Collect all unique tenant_ids from existing tables
 */
async function collectTenantIds(): Promise<Set<string>> {
  const tenantIds = new Set<string>();
  const tables = [
    WORKFLOWS_TABLE,
    FORMS_TABLE,
    SUBMISSIONS_TABLE,
    JOBS_TABLE,
    ARTIFACTS_TABLE,
    TEMPLATES_TABLE,
    USER_SETTINGS_TABLE,
    NOTIFICATIONS_TABLE,
  ];

  console.log('Collecting tenant IDs from existing tables...');

  for (const tableName of tables) {
    try {
      let lastEvaluatedKey: any = undefined;
      do {
        const command = new ScanCommand({
          TableName: tableName,
          ProjectionExpression: 'tenant_id',
          ExclusiveStartKey: lastEvaluatedKey,
        });

        const result = await docClient.send(command);
        
        if (result.Items) {
          for (const item of result.Items) {
            if (item.tenant_id) {
              tenantIds.add(item.tenant_id);
            }
          }
        }

        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      console.log(`  Found ${tenantIds.size} unique tenant IDs from ${tableName}`);
    } catch (error) {
      console.error(`Error scanning ${tableName}:`, error);
    }
  }

  return tenantIds;
}

/**
 * Create Customer records for each tenant_id
 */
async function createCustomers(tenantIds: Set<string>): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  const now = new Date().toISOString();

  console.log('\nCreating Customer records...');

  for (const tenantId of tenantIds) {
    // Use tenant_id as customer_id (1:1 mapping)
    const customerId = tenantId;

    try {
      // Check if customer already exists
      const getCommand = new QueryCommand({
        TableName: CUSTOMERS_TABLE,
        KeyConditionExpression: 'customer_id = :customer_id',
        ExpressionAttributeValues: {
          ':customer_id': customerId,
        },
        Limit: 1,
      });

      const existing = await docClient.send(getCommand);

      if (!existing.Items || existing.Items.length === 0) {
        // Create customer record
        const putCommand = new PutCommand({
          TableName: CUSTOMERS_TABLE,
          Item: {
            customer_id: customerId,
            name: `Customer ${customerId}`,
            email: '', // Will be updated if we find user info
            created_at: now,
            updated_at: now,
          },
        });

        await docClient.send(putCommand);
        console.log(`  Created customer: ${customerId}`);
      } else {
        console.log(`  Customer already exists: ${customerId}`);
      }

      mapping.set(tenantId, customerId);
    } catch (error) {
      console.error(`Error creating customer for ${tenantId}:`, error);
    }
  }

  return mapping;
}

/**
 * Update records in a table to include customer_id
 */
async function updateTableRecords(
  tableName: string,
  mapping: Map<string, string>,
  keyField: string
): Promise<number> {
  let updated = 0;
  let lastEvaluatedKey: any = undefined;

  console.log(`\nUpdating ${tableName}...`);

  do {
    try {
      const scanCommand = new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
      });

      const result = await docClient.send(scanCommand);

      if (result.Items) {
        for (const item of result.Items) {
          if (item.tenant_id && !item.customer_id) {
            const customerId = mapping.get(item.tenant_id);
            if (customerId) {
              try {
                const updateCommand = new UpdateCommand({
                  TableName: tableName,
                  Key: { [keyField]: item[keyField] },
                  UpdateExpression: 'SET customer_id = :customer_id',
                  ExpressionAttributeValues: {
                    ':customer_id': customerId,
                  },
                });

                await docClient.send(updateCommand);
                updated++;
              } catch (error) {
                console.error(`Error updating ${tableName} record ${item[keyField]}:`, error);
              }
            }
          }
        }
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } catch (error) {
      console.error(`Error scanning ${tableName}:`, error);
      break;
    }
  } while (lastEvaluatedKey);

  console.log(`  Updated ${updated} records in ${tableName}`);
  return updated;
}

/**
 * Migrate Cognito users to Users table
 */
async function migrateCognitoUsers(mapping: Map<string, string>): Promise<number> {
  if (!USER_POOL_ID) {
    console.log('\n⚠️  USER_POOL_ID not set, skipping Cognito user migration');
    return 0;
  }

  console.log('\nMigrating Cognito users to Users table...');
  let migrated = 0;

  try {
    let paginationToken: string | undefined;
    do {
      const listCommand = new ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        PaginationToken: paginationToken,
      });

      const result = await cognitoClient.send(listCommand);
      paginationToken = result.PaginationToken;

      if (result.Users) {
        for (const cognitoUser of result.Users) {
          try {
            const userId = cognitoUser.Attributes?.find((attr: AttributeType) => attr.Name === 'sub')?.Value;
            const email = cognitoUser.Attributes?.find((attr: AttributeType) => attr.Name === 'email')?.Value;
            const name = cognitoUser.Attributes?.find((attr: AttributeType) => attr.Name === 'name')?.Value || email || 'Unknown';
            const legacyTenantId = cognitoUser.Attributes?.find((attr: AttributeType) => attr.Name === 'custom:tenant_id')?.Value;
            const role = cognitoUser.Attributes?.find((attr: AttributeType) => attr.Name === 'custom:role')?.Value || 'USER';
            const existingCustomerId = cognitoUser.Attributes?.find((attr: AttributeType) => attr.Name === 'custom:customer_id')?.Value;

            if (!userId || !email) {
              console.log(`  ⚠️  Skipping user without sub or email: ${cognitoUser.Username}`);
              continue;
            }

            // Determine customer_id
            let customerId = existingCustomerId;
            if (!customerId && legacyTenantId) {
              customerId = mapping.get(legacyTenantId) || legacyTenantId;
            }
            if (!customerId) {
              // Generate new customer_id if none exists
              customerId = `cust_${userId.substring(0, 8)}`;
              console.log(`  ⚠️  Generated new customer_id ${customerId} for user ${email}`);
            }

            // Check if user already exists
            const existingUser = await docClient.send(new QueryCommand({
              TableName: USERS_TABLE,
              KeyConditionExpression: 'user_id = :user_id',
              ExpressionAttributeValues: {
                ':user_id': userId,
              },
              Limit: 1,
            }));

            if (!existingUser.Items || existingUser.Items.length === 0) {
              // Create User record
              await docClient.send(new PutCommand({
                TableName: USERS_TABLE,
                Item: {
                  user_id: userId,
                  customer_id: customerId,
                  email: email,
                  name: name,
                  role: role,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              }));
              console.log(`  ✓ Created user: ${email} (${userId}) -> customer: ${customerId}`);
              migrated++;
            } else {
              console.log(`  - User already exists: ${email}`);
            }

            // Update Cognito custom:customer_id if not set
            if (!existingCustomerId || existingCustomerId !== customerId) {
              await cognitoClient.send(new AdminUpdateUserAttributesCommand({
                UserPoolId: USER_POOL_ID,
                Username: cognitoUser.Username!,
                UserAttributes: [
                  { Name: 'custom:customer_id', Value: customerId },
                ],
              }));
              console.log(`  ✓ Updated Cognito user ${email} with customer_id: ${customerId}`);
            }

            // Update customer record with user info if available
            const customer = await docClient.send(new QueryCommand({
              TableName: CUSTOMERS_TABLE,
              KeyConditionExpression: 'customer_id = :customer_id',
              ExpressionAttributeValues: {
                ':customer_id': customerId,
              },
              Limit: 1,
            }));

            if (customer.Items && customer.Items.length > 0) {
              // Update customer with user info if not set
              const customerRecord = customer.Items[0];
              if (!customerRecord.email || customerRecord.email === '') {
                await docClient.send(new UpdateCommand({
                  TableName: CUSTOMERS_TABLE,
                  Key: { customer_id: customerId },
                  UpdateExpression: 'SET email = :email, name = :name, updated_at = :updated_at',
                  ExpressionAttributeValues: {
                    ':email': email,
                    ':name': name,
                    ':updated_at': new Date().toISOString(),
                  },
                }));
                console.log(`  ✓ Updated customer ${customerId} with user info`);
              }
            }
          } catch (error) {
            console.error(`  ✗ Error migrating user ${cognitoUser.Username}:`, error);
          }
        }
      }
    } while (paginationToken);

    console.log(`\n✓ Migrated ${migrated} Cognito users to Users table`);
  } catch (error) {
    console.error('Error migrating Cognito users:', error);
  }

  return migrated;
}

/**
 * Create S3 folder structure for each customer
 */
async function createS3Folders(customerIds: Set<string>): Promise<number> {
  if (!ARTIFACTS_BUCKET) {
    console.log('\n⚠️  ARTIFACTS_BUCKET not set, skipping S3 folder creation');
    return 0;
  }

  console.log('\nCreating S3 folders for customers...');
  let created = 0;

  for (const customerId of customerIds) {
    try {
      // Create folder marker (empty file) at customers/{customerId}/.folder
      // This ensures the prefix exists and can be listed
      const folderKey = `customers/${customerId}/.folder`;
      
      // Check if folder already exists
      try {
        await s3Client.send(new HeadObjectCommand({
          Bucket: ARTIFACTS_BUCKET,
          Key: folderKey,
        }));
        console.log(`  - Folder already exists: customers/${customerId}/`);
      } catch (error: any) {
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
          // Create folder marker
          await s3Client.send(new PutObjectCommand({
            Bucket: ARTIFACTS_BUCKET,
            Key: folderKey,
            Body: Buffer.from(''),
            ContentType: 'application/x-directory',
          }));
          console.log(`  ✓ Created folder: customers/${customerId}/`);
          created++;
        } else {
          console.error(`  ✗ Error creating folder for ${customerId}:`, error);
        }
      }
    } catch (error) {
      console.error(`  ✗ Error creating S3 folder for ${customerId}:`, error);
    }
  }

  console.log(`\n✓ Created ${created} S3 folders`);
  return created;
}

/**
 * Main migration function
 */
async function migrate(): Promise<void> {
  console.log('Starting migration from tenant_id to customerId...\n');
  console.log(`AWS Region: ${AWS_REGION}`);
  console.log(`User Pool ID: ${USER_POOL_ID || 'NOT SET'}`);
  console.log(`Artifacts Bucket: ${ARTIFACTS_BUCKET || 'NOT SET'}\n`);

  try {
    // Step 1: Collect all tenant IDs
    const tenantIds = await collectTenantIds();
    console.log(`\nFound ${tenantIds.size} unique tenant IDs\n`);

    if (tenantIds.size === 0) {
      console.log('No tenant IDs found. Nothing to migrate.');
      return;
    }

    // Step 2: Create Customer records
    const mapping = await createCustomers(tenantIds);
    console.log(`\nCreated ${mapping.size} customer records\n`);

    // Step 3: Migrate Cognito users to Users table
    const migratedUsers = await migrateCognitoUsers(mapping);

    // Step 4: Create S3 folders for each customer
    const customerIds = new Set(mapping.values());
    const createdFolders = await createS3Folders(customerIds);

    // Step 5: Update existing tables
    const tables = [
      { name: WORKFLOWS_TABLE, key: 'workflow_id' },
      { name: FORMS_TABLE, key: 'form_id' },
      { name: SUBMISSIONS_TABLE, key: 'submission_id' },
      { name: JOBS_TABLE, key: 'job_id' },
      { name: ARTIFACTS_TABLE, key: 'artifact_id' },
      { name: TEMPLATES_TABLE, key: 'template_id' },
      { name: USER_SETTINGS_TABLE, key: 'tenant_id' }, // Note: tenant_id is the key
      { name: NOTIFICATIONS_TABLE, key: 'notification_id' },
    ];

    let totalUpdated = 0;
    for (const table of tables) {
      const updated = await updateTableRecords(table.name, mapping, table.key);
      totalUpdated += updated;
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   - Created ${mapping.size} customer records`);
    console.log(`   - Migrated ${migratedUsers} Cognito users to Users table`);
    console.log(`   - Created ${createdFolders} S3 folders`);
    console.log(`   - Updated ${totalUpdated} records across all tables`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  migrate().catch(console.error);
}

export { migrate };

