#!/usr/bin/env ts-node

/**
 * Script to create a new user in Cognito User Pool
 * Usage: ts-node scripts/admin/create-user.ts <email> <password> <name>
 * 
 * This script:
 * 1. Creates the user in Cognito User Pool
 * 2. Sets the password
 * 3. Sets the name attribute
 * 4. The postConfirmation Lambda will automatically create DynamoDB records
 */

import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminUpdateUserAttributesCommand, UserNotFoundException } from '@aws-sdk/client-cognito-identity-provider'
import * as dotenv from 'dotenv'

dotenv.config()

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || process.env.USER_POOL_ID || 'us-east-1_asu0YOrBD'
const AWS_REGION = process.env.AWS_REGION || 'us-east-1'

const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION })

async function createUser(email: string, password: string, name: string) {
  try {
    console.log(`Creating user: ${email}`)
    console.log(`User Pool: ${USER_POOL_ID}`)
    console.log(`Region: ${AWS_REGION}\n`)

    // Step 1: Create user in Cognito
    console.log('Step 1: Creating user in Cognito...')
    try {
      await cognitoClient.send(new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        UserAttributes: [
          {
            Name: 'email',
            Value: email,
          },
          {
            Name: 'email_verified',
            Value: 'true',
          },
          {
            Name: 'name',
            Value: name,
          },
        ],
        MessageAction: 'SUPPRESS', // Don't send welcome email
        TemporaryPassword: password, // Set temporary password
      }))
      console.log('✓ User created in Cognito')
    } catch (error: any) {
      if (error.name === 'UsernameExistsException') {
        console.log('⚠️  User already exists in Cognito, proceeding to set password...')
      } else {
        throw error
      }
    }

    // Step 2: Set permanent password (so user doesn't need to change it)
    console.log('Step 2: Setting permanent password...')
    try {
      await cognitoClient.send(new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        Password: password,
        Permanent: true, // Set as permanent password
      }))
      console.log('✓ Password set')
    } catch (error: any) {
      if (error.name === 'InvalidPasswordException') {
        console.error('❌ Password does not meet requirements:')
        console.error('   - Must be at least 8 characters')
        console.error('   - Must contain uppercase letters')
        console.error('   - Must contain lowercase letters')
        console.error('   - Must contain numbers')
        throw error
      }
      throw error
    }

    // Step 3: Ensure name attribute is set
    console.log('Step 3: Setting name attribute...')
    try {
      await cognitoClient.send(new AdminUpdateUserAttributesCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        UserAttributes: [
          {
            Name: 'name',
            Value: name,
          },
        ],
      }))
      console.log('✓ Name attribute set')
    } catch (error: any) {
      // If user doesn't exist, this will fail, but that's okay
      if (error.name !== 'UserNotFoundException') {
        console.warn(`⚠️  Could not update name attribute: ${error.message}`)
      }
    }

    console.log('\n✅ Successfully created user!')
    console.log(`   Email: ${email}`)
    console.log(`   Name: ${name}`)
    console.log(`   Password: ${password}`)
    console.log('\nNote: The postConfirmation Lambda will automatically create DynamoDB records.')
    console.log('The user can now sign in immediately.')

  } catch (error: any) {
    console.error('\n❌ Error creating user:', error)
    if (error.message) {
      console.error('Error message:', error.message)
    }
    if (error.name) {
      console.error('Error name:', error.name)
    }
    process.exit(1)
  }
}

// Get arguments from command line
const email = process.argv[2]
const password = process.argv[3]
const name = process.argv[4] || email.split('@')[0] // Default name from email if not provided

if (!email || !password) {
  console.error('Usage: ts-node scripts/admin/create-user.ts <email> <password> [name]')
  console.error('Example: ts-node scripts/admin/create-user.ts marquez.joselitoken@gmail.com Password123! "Jose Marquez"')
  process.exit(1)
}

// Validate email format
if (!email.includes('@')) {
  console.error('Error: Invalid email format')
  process.exit(1)
}

// Validate password requirements
if (password.length < 8) {
  console.error('Error: Password must be at least 8 characters')
  process.exit(1)
}

if (!/[A-Z]/.test(password)) {
  console.error('Error: Password must contain at least one uppercase letter')
  process.exit(1)
}

if (!/[a-z]/.test(password)) {
  console.error('Error: Password must contain at least one lowercase letter')
  process.exit(1)
}

if (!/[0-9]/.test(password)) {
  console.error('Error: Password must contain at least one number')
  process.exit(1)
}

createUser(email, password, name)
  .then(() => {
    console.log('\nDone!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })





