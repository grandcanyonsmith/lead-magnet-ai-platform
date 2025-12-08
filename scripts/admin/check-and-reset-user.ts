#!/usr/bin/env ts-node

/**
 * Script to check user status in Cognito and optionally reset password
 * Usage: 
 *   ts-node scripts/admin/check-and-reset-user.ts <email> [new_password]
 * 
 * If new_password is provided, it will reset the password.
 * If not provided, it will only check the user status.
 */

import { 
  CognitoIdentityProviderClient, 
  AdminGetUserCommand, 
  AdminSetUserPasswordCommand,
  UserNotFoundException 
} from '@aws-sdk/client-cognito-identity-provider'
import * as dotenv from 'dotenv'

dotenv.config()

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || process.env.USER_POOL_ID || 'us-east-1_asu0YOrBD'
const AWS_REGION = process.env.AWS_REGION || 'us-east-1'

const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION })

async function checkAndResetUser(email: string, newPassword?: string) {
  try {
    console.log(`\n🔍 Checking user: ${email}`)
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
      console.log('✓ User found in Cognito\n')
    } catch (error: any) {
      if (error.name === 'UserNotFoundException') {
        console.error(`❌ User not found in Cognito with email: ${email}`)
        console.error('\nTo create the user, run:')
        console.error(`  npx tsx scripts/admin/create-user.ts ${email} <password> <name>`)
        process.exit(1)
      }
      throw error
    }

    // Display user information
    console.log('📋 User Information:')
    console.log(`   Username: ${cognitoUser.Username}`)
    console.log(`   Status: ${cognitoUser.UserStatus}`)
    console.log(`   Enabled: ${cognitoUser.Enabled ? 'Yes' : 'No'}`)
    console.log(`   Created: ${cognitoUser.UserCreateDate?.toISOString()}`)
    console.log(`   Modified: ${cognitoUser.UserLastModifiedDate?.toISOString()}`)
    
    if (cognitoUser.UserAttributes && cognitoUser.UserAttributes.length > 0) {
      console.log('\n   Attributes:')
      cognitoUser.UserAttributes.forEach(attr => {
        // Don't show sensitive attributes
        if (attr.Name !== 'sub' && !attr.Name?.includes('password')) {
          console.log(`     ${attr.Name}: ${attr.Value}`)
        }
      })
    }

    // Check if password reset is needed
    if (cognitoUser.UserStatus === 'FORCE_CHANGE_PASSWORD') {
      console.log('\n⚠️  User status is FORCE_CHANGE_PASSWORD')
      console.log('   This means the user needs to change their password on first login.')
      console.log('   To set a permanent password, provide a new_password argument.')
    }

    // Step 2: Reset password if provided
    if (newPassword) {
      console.log('\nStep 2: Resetting password...')
      
      // Validate password requirements
      if (newPassword.length < 8) {
        console.error('❌ Password must be at least 8 characters')
        process.exit(1)
      }
      if (!/[A-Z]/.test(newPassword)) {
        console.error('❌ Password must contain at least one uppercase letter')
        process.exit(1)
      }
      if (!/[a-z]/.test(newPassword)) {
        console.error('❌ Password must contain at least one lowercase letter')
        process.exit(1)
      }
      if (!/[0-9]/.test(newPassword)) {
        console.error('❌ Password must contain at least one number')
        process.exit(1)
      }

      try {
        await cognitoClient.send(new AdminSetUserPasswordCommand({
          UserPoolId: USER_POOL_ID,
          Username: email,
          Password: newPassword,
          Permanent: true, // Set as permanent password
        }))
        console.log('✓ Password reset successfully')
        console.log(`\n✅ User can now log in with the new password`)
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
    } else {
      console.log('\n💡 To reset the password, run:')
      console.log(`   npx tsx scripts/admin/check-and-reset-user.ts ${email} <new_password>`)
    }

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

// Get arguments from command line
const email = process.argv[2]
const newPassword = process.argv[3]

if (!email) {
  console.error('Usage: ts-node scripts/admin/check-and-reset-user.ts <email> [new_password]')
  console.error('\nExamples:')
  console.error('  # Check user status only:')
  console.error('  npx tsx scripts/admin/check-and-reset-user.ts thurstoncapitalgoods@gmail.com')
  console.error('\n  # Check and reset password:')
  console.error('  npx tsx scripts/admin/check-and-reset-user.ts thurstoncapitalgoods@gmail.com BradenThurston2024!')
  process.exit(1)
}

// Validate email format
if (!email.includes('@')) {
  console.error('Error: Invalid email format')
  process.exit(1)
}

checkAndResetUser(email, newPassword)
  .then(() => {
    console.log('\nDone!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

