/**
 * Fix missing Customer records for generated customer_ids
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE = 'leadmagnet-users';
const CUSTOMERS_TABLE = 'leadmagnet-customers';

async function fixMissingCustomers() {
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
        console.log(`✓ Created customer: ${user.customer_id} for ${user.email}`);
        created++;
      }
    }
  }
  
  console.log(`\n✅ Created ${created} missing Customer records`);
}

fixMissingCustomers().catch(console.error);

