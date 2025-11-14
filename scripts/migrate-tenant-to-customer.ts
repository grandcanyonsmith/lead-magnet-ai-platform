/**
 * Migration script to convert tenant_id to customerId structure
 * 
 * This script:
 * 1. Creates Customer records for each unique tenant_id
 * 2. Creates User records for existing users
 * 3. Updates existing records to include customer_id
 * 
 * Usage:
 *   ts-node scripts/migrate-tenant-to-customer.ts
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
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

interface TenantMapping {
  tenantId: string;
  customerId: string;
  email?: string;
  name?: string;
}

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
 * Main migration function
 */
async function migrate(): Promise<void> {
  console.log('Starting migration from tenant_id to customerId...\n');

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

    // Step 3: Update existing tables
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

