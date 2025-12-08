#!/usr/bin/env ts-node

/**
 * Script to create user record in DynamoDB and set SUPER_ADMIN role
 * Usage: npx tsx scripts/admin/create-and-set-super-admin.ts <email> [name]
 * 
 * This script:
 * 1. Gets user from Cognito
 * 2. Generates customer_id based on email (same algorithm as postConfirmation Lambda)
 * 3. Creates user record in DynamoDB with SUPER_ADMIN role
 * 4. Creates customer record if needed
 * 5. Sets custom:role and custom:customer_id in Cognito
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { CognitoIdentityProviderClient, AdminGetUserCommand, AdminUpdateUserAttributesCommand } from '@aws-sdk/client-cognito-identity-provider'
import * as dotenv from 'dotenv'
import * as crypto from 'crypto'

dotenv.config()

const USERS_TABLE = process.env.USERS_TABLE || 'leadmagnet-users'
const CUSTOMERS_TABLE = process.env.CUSTOMERS_TABLE || 'leadmagnet-customers'
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || process.env.USER_POOL_ID || 'us-east-1_asu0YOrBD'
const AWS_REGION = process.env.AWS_REGION || 'us-east-1'

const dynamoClient = new DynamoDBClient({ region: AWS_REGION })
const docClient = DynamoDBDocumentClient.from(dynamoClient)
const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION })

/**
 * Generate customer_id from email (same algorithm as postConfirmation Lambda)
 */
function generateCustomerId(email: string): string {
  return crypto.createHash('sha256')
    .update(email.toLowerCase())
    .digest('hex')
    .substring(0, 16)
}

async function createAndSetSuperAdmin(email: string, name?: string) {
  try {
    console.log(`\n🚀 Creating user record and setting SUPER_ADMIN role for: ${email}`)
    console.log(`User Pool: ${USER_POOL_ID}`)
    console.log(`Region: ${AWS_REGION}\n`)

    // Step 1: Get user from Cognito
    console.log('Step 1: Getting user from Cognito...')
    let cognitoUser
    try {
      const getUserResult = await cognitoClient.send(new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
      }))
      cognitoUser = getUserResult
      console.log(`✓ Found user in Cognito`)
      console.log(`  - User ID (sub): ${cognitoUser.Username}`)
      console.log(`  - Email: ${cognitoUser.UserAttributes?.find(a => a.Name === 'email')?.Value || email}`)
    } catch (error: any) {
      if (error.name === 'UserNotFoundException') {
        console.error(`❌ User not found in Cognito with email: ${email}`)
        console.error('Please create the user in Cognito first using create-user.ts script')
        process.exit(1)
      }
      throw error
    }

    const userId = cognitoUser.Username!
    const userEmail = cognitoUser.UserAttributes?.find(a => a.Name === 'email')?.Value || email
    const userName = name || cognitoUser.UserAttributes?.find(a => a.Name === 'name')?.Value || userEmail.split('@')[0]

    // Step 2: Generate customer_id
    console.log('\nStep 2: Generating customer_id...')
    let customerId = cognitoUser.UserAttributes?.find(a => a.Name === 'custom:customer_id')?.Value
    if (!customerId) {
      customerId = generateCustomerId(userEmail)
      console.log(`✓ Generated customer_id: ${customerId}`)
    } else {
      console.log(`✓ Using existing customer_id: ${customerId}`)
    }

    // Step 3: Create customer record if needed
    console.log('\nStep 3: Creating/updating customer record...')
    try {
      const existingCustomer = await docClient.send(new QueryCommand({
        TableName: CUSTOMERS_TABLE,
        KeyConditionExpression: 'customer_id = :cid',
        ExpressionAttributeValues: { ':cid': customerId },
        Limit: 1,
      }))

      if (!existingCustomer.Items || existingCustomer.Items.length === 0) {
        const now = new Date().toISOString()
        await docClient.send(new PutCommand({
          TableName: CUSTOMERS_TABLE,
          Item: {
            customer_id: customerId,
            name: userName,
            email: userEmail,
            created_at: now,
            updated_at: now,
          },
        }))
        console.log(`✓ Created customer record: ${customerId}`)
      } else {
        console.log(`✓ Customer record already exists: ${customerId}`)
      }
    } catch (error: any) {
      console.error(`⚠️  Error creating customer record: ${error.message}`)
      // Continue anyway
    }

    // Step 4: Create user record in DynamoDB with SUPER_ADMIN role
    console.log('\nStep 4: Creating/updating user record in DynamoDB...')
    const now = new Date().toISOString()
    
    // Check if user already exists
    let existingUser
    try {
      const userQuery = await docClient.send(new QueryCommand({
        TableName: USERS_TABLE,
        KeyConditionExpression: 'user_id = :uid',
        ExpressionAttributeValues: { ':uid': userId },
        Limit: 1,
      }))
      existingUser = userQuery.Items?.[0]
    } catch (error: any) {
      // Table might not have query capability, try scan
      const scanResult = await docClient.send(new ScanCommand({
        TableName: USERS_TABLE,
        FilterExpression: 'user_id = :uid',
        ExpressionAttributeValues: { ':uid': userId },
        Limit: 1,
      }))
      existingUser = scanResult.Items?.[0]
    }

    if (existingUser) {
      // Update existing user
      const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb')
      await docClient.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { user_id: userId },
        UpdateExpression: 'SET #role = :role, customer_id = :customer_id, email = :email, name = :name, updated_at = :updated_at',
        ExpressionAttributeNames: {
          '#role': 'role',
        },
        ExpressionAttributeValues: {
          ':role': 'SUPER_ADMIN',
          ':customer_id': customerId,
          ':email': userEmail,
          ':name': userName,
          ':updated_at': now,
        },
      }))
      console.log(`✓ Updated user record with SUPER_ADMIN role`)
    } else {
      // Create new user
      await docClient.send(new PutCommand({
        TableName: USERS_TABLE,
        Item: {
          user_id: userId,
          email: userEmail,
          name: userName,
          customer_id: customerId,
          role: 'SUPER_ADMIN',
          created_at: now,
          updated_at: now,
        },
      }))
      console.log(`✓ Created user record with SUPER_ADMIN role`)
    }

    // Step 5: Update Cognito attributes
    console.log('\nStep 5: Updating Cognito custom attributes...')
    await cognitoClient.send(new AdminUpdateUserAttributesCommand({
      UserPoolId: USER_POOL_ID,
      Username: userId,
      UserAttributes: [
        {
          Name: 'custom:role',
          Value: 'SUPER_ADMIN',
        },
        {
          Name: 'custom:customer_id',
          Value: customerId,
        },
      ],
    }))
    console.log(`✓ Updated Cognito custom:role to SUPER_ADMIN`)
    console.log(`✓ Updated Cognito custom:customer_id to ${customerId}`)

    console.log('\n✅ Successfully completed!')
    console.log(`\n📋 Summary:`)
    console.log(`   Email: ${userEmail}`)
    console.log(`   Name: ${userName}`)
    console.log(`   User ID: ${userId}`)
    console.log(`   Customer ID: ${customerId}`)
    console.log(`   Role: SUPER_ADMIN`)
    console.log(`\n💡 Note: User may need to log out and log back in for changes to take effect.`)

  } catch (error: any) {
    console.error('\n❌ Error:', error)
    if (error.message) {
      console.error('Error message:', error.message)
    }
    if (error.name) {
      console.error('Error name:', error.name)
    }
    process.exit(1)
  }
}

// Get email from command line arguments
const email = process.argv[2]
const name = process.argv[3]

if (!email) {
  console.error('Usage: npx tsx scripts/admin/create-and-set-super-admin.ts <email> [name]')
  console.error('Example: npx tsx scripts/admin/create-and-set-super-admin.ts marquez.joselitoken@gmail.com "Jose Marquez"')
  process.exit(1)
}

// Validate email format
if (!email.includes('@')) {
  console.error('Error: Invalid email format')
  process.exit(1)
}

createAndSetSuperAdmin(email, name)
  .then(() => {
    console.log('\nDone!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })



