/**
 * Fix missing Customer records for generated customer_ids
 */
import {
  getDynamoDbDocumentClient,
  getTableName,
  getAwsRegion,
  printSuccess,
  printError,
  printSection,
} from '../lib/common';
import { ScanCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const docClient = getDynamoDbDocumentClient();

const USERS_TABLE = getTableName('users');
const CUSTOMERS_TABLE = getTableName('customers');

async function fixMissingCustomers() {
  printSection('Fix Missing Customer Records');
  console.log('Scanning Users table for generated customer_ids...');
  const users = await docClient.send(new ScanCommand({ TableName: USERS_TABLE }));
  
  let created = 0;
  for (const user of users.Items || []) {
    if (user.customer_id?.startsWith('cust_')) {
      // Check if customer exists
      const existing = await docClient.send(new QueryCommand({
        TableName: CUSTOMERS_TABLE,
        KeyConditionExpression: 'customer_id = :cid',
        ExpressionAttributeValues: { ':cid': user.customer_id },
        Limit: 1,
      }));
      
      if (!existing.Items || existing.Items.length === 0) {
        await docClient.send(new PutCommand({
          TableName: CUSTOMERS_TABLE,
          Item: {
            customer_id: user.customer_id,
            name: user.name || user.email || `Customer ${user.customer_id}`,
            email: user.email || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        }));
        printSuccess(`Created customer: ${user.customer_id} for ${user.email}`);
        created++;
      }
    }
  }
  
  printSection('Summary');
  printSuccess(`Created ${created} missing Customer records`);
}

fixMissingCustomers().catch((error) => {
  printError(`Failed to fix missing customers: ${error}`);
  process.exit(1);
});

