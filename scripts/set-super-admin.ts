#!/usr/bin/env ts-node

/**
 * Script to set SUPER_ADMIN role for a user
 * Usage: ts-node scripts/set-super-admin.ts <email>
 * 
 * This script:
 * 1. Updates the user's role in the Users DynamoDB table
 * 2. Updates the user's custom:role attribute in Cognito
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { CognitoIdentityProviderClient, AdminGetUserCommand, AdminUpdateUserAttributesCommand } from '@aws-sdk/client-cognito-identity-provider'
import * as dotenv from 'dotenv'

dotenv.config()

const USERS_TABLE = process.env.USERS_TABLE || 'leadmagnet-users'
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || process.env.USER_POOL_ID

if (!USER_POOL_ID) {
  console.error('Error: COGNITO_USER_POOL_ID or USER_POOL_ID environment variable is required')
  process.exit(1)
}

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
const docClient = DynamoDBDocumentClient.from(dynamoClient)
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'us-east-1' })

async function setSuperAdmin(email: string) {
  try {
    console.log(`Setting SUPER_ADMIN role for ${email}...`)

    // Step 1: Find user in DynamoDB by email
    console.log('Step 1: Searching for user in DynamoDB...')
    
    // Note: This assumes you have a GSI on email, or you'll need to scan
    // For now, we'll try to get by user_id if email is the user_id, or scan
    let user: any = null
    
    // Try scanning for the user (in production, use GSI on email)
    const { ScanCommand } = await import('@aws-sdk/lib-dynamodb')
    const scanResult = await docClient.send(new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email,
      },
      Limit: 1,
    }))
    
    if (scanResult.Items && scanResult.Items.length > 0) {
      user = scanResult.Items[0]
      console.log(`Found user in DynamoDB: ${user.user_id}`)
    } else {
      console.error(`User not found in DynamoDB with email: ${email}`)
      console.log('Note: User must exist in DynamoDB first. Create the user or check the email.')
      process.exit(1)
    }

    // Step 2: Update DynamoDB user record
    console.log('Step 2: Updating user role in DynamoDB...')
    await docClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { user_id: user.user_id },
      UpdateExpression: 'SET #role = :role, updated_at = :updated_at',
      ExpressionAttributeNames: {
        '#role': 'role',
      },
      ExpressionAttributeValues: {
        ':role': 'SUPER_ADMIN',
        ':updated_at': new Date().toISOString(),
      },
    }))
    console.log('✓ Updated DynamoDB user record')

    // Step 3: Update Cognito custom attribute
    console.log('Step 3: Updating Cognito custom:role attribute...')
    
    // Get Cognito username (could be email or a different username)
    let cognitoUsername = email
    
    // Try to get user from Cognito to find the actual username
    try {
      const getUserResult = await cognitoClient.send(new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
      }))
      cognitoUsername = getUserResult.Username || email
    } catch (error: any) {
      if (error.name === 'UserNotFoundException') {
        console.error(`User not found in Cognito with email: ${email}`)
        console.log('Note: User must exist in Cognito first. Create the user or check the email.')
        process.exit(1)
      }
      // If it's a different error, try using email as username
      console.warn(`Could not get user from Cognito, using email as username: ${error.message}`)
    }

    // Update the custom:role attribute
    await cognitoClient.send(new AdminUpdateUserAttributesCommand({
      UserPoolId: USER_POOL_ID,
      Username: cognitoUsername,
      UserAttributes: [
        {
          Name: 'custom:role',
          Value: 'SUPER_ADMIN',
        },
      ],
    }))
    console.log('✓ Updated Cognito custom:role attribute')

    console.log('\n✅ Successfully set SUPER_ADMIN role for', email)
    console.log(`   - DynamoDB user_id: ${user.user_id}`)
    console.log(`   - Cognito username: ${cognitoUsername}`)
    console.log('\nNote: User may need to log out and log back in for changes to take effect.')

  } catch (error: any) {
    console.error('Error setting SUPER_ADMIN role:', error)
    if (error.message) {
      console.error('Error message:', error.message)
    }
    process.exit(1)
  }
}

// Get email from command line arguments
const email = process.argv[2]

if (!email) {
  console.error('Usage: ts-node scripts/set-super-admin.ts <email>')
  console.error('Example: ts-node scripts/set-super-admin.ts canyon@coursecreator360.com')
  process.exit(1)
}

// Validate email format
if (!email.includes('@')) {
  console.error('Error: Invalid email format')
  process.exit(1)
}

setSuperAdmin(email)
  .then(() => {
    console.log('\nDone!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

