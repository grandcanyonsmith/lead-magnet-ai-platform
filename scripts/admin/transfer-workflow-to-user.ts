#!/usr/bin/env ts-node

/**
 * Script to transfer a workflow and all its jobs to a user's customer_id
 * Usage: npx tsx scripts/admin/transfer-workflow-to-user.ts <workflow_id_or_template_id> <email>
 * 
 * This script:
 * 1. Finds the workflow by workflow_id or template_id
 * 2. Finds the user by email
 * 3. Transfers the workflow to the user's customer_id
 * 4. Transfers all jobs associated with the workflow
 * 5. Transfers the form if it exists
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, QueryCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { CognitoIdentityProviderClient, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider'
import * as dotenv from 'dotenv'

dotenv.config()

const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || 'leadmagnet-workflows'
const JOBS_TABLE = process.env.JOBS_TABLE || 'leadmagnet-jobs'
const FORMS_TABLE = process.env.FORMS_TABLE || 'leadmagnet-forms'
const USERS_TABLE = process.env.USERS_TABLE || 'leadmagnet-users'
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || process.env.USER_POOL_ID || 'us-east-1_asu0YOrBD'
const AWS_REGION = process.env.AWS_REGION || 'us-east-1'

const dynamoClient = new DynamoDBClient({ region: AWS_REGION })
const docClient = DynamoDBDocumentClient.from(dynamoClient)
const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION })

async function transferWorkflowToUser(workflowIdentifier: string, email: string) {
  try {
    console.log(`\n🚀 Transferring workflow to user: ${email}`)
    console.log(`Workflow identifier: ${workflowIdentifier}\n`)

    // Step 1: Find user
    console.log('Step 1: Finding user...')
    let user
    try {
      // First try to get from Cognito to get userId
      const cognitoUser = await cognitoClient.send(new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
      }))
      const userId = cognitoUser.Username!

      // Then get from DynamoDB to get customer_id
      const userQuery = await docClient.send(new QueryCommand({
        TableName: USERS_TABLE,
        KeyConditionExpression: 'user_id = :uid',
        ExpressionAttributeValues: { ':uid': userId },
        Limit: 1,
      }))
      user = userQuery.Items?.[0]

      if (!user) {
        // Try scan as fallback
        const scanResult = await docClient.send(new ScanCommand({
          TableName: USERS_TABLE,
          FilterExpression: 'email = :email',
          ExpressionAttributeValues: { ':email': email },
          Limit: 1,
        }))
        user = scanResult.Items?.[0]
      }
    } catch (error: any) {
      console.error(`❌ Error finding user: ${error.message}`)
      process.exit(1)
    }

    if (!user || !user.customer_id) {
      console.error(`❌ User not found or missing customer_id: ${email}`)
      process.exit(1)
    }

    console.log(`✓ Found user:`)
    console.log(`  - Email: ${user.email}`)
    console.log(`  - Name: ${user.name}`)
    console.log(`  - Customer ID: ${user.customer_id}`)

    // Step 2: Find workflow
    console.log('\nStep 2: Finding workflow...')
    let workflow
    
    // Try to find by workflow_id first
    try {
      const workflowQuery = await docClient.send(new QueryCommand({
        TableName: WORKFLOWS_TABLE,
        KeyConditionExpression: 'workflow_id = :wid',
        ExpressionAttributeValues: { ':wid': workflowIdentifier },
        Limit: 1,
      }))
      workflow = workflowQuery.Items?.[0]
    } catch (error) {
      // Not found by workflow_id, continue
    }

    // If not found, try scanning by template_id or workflow_name
    if (!workflow) {
      const scanResult = await docClient.send(new ScanCommand({
        TableName: WORKFLOWS_TABLE,
        FilterExpression: 'template_id = :tid OR workflow_name = :wname',
        ExpressionAttributeValues: {
          ':tid': workflowIdentifier,
          ':wname': workflowIdentifier,
        },
        Limit: 100,
      }))
      
      // Find exact match
      workflow = scanResult.Items?.find((w: any) => 
        w.template_id === workflowIdentifier || 
        w.workflow_name === workflowIdentifier ||
        w.workflow_id === workflowIdentifier
      )
    }

    if (!workflow) {
      console.error(`❌ Workflow not found: ${workflowIdentifier}`)
      console.log('Tried searching by: workflow_id, template_id, workflow_name')
      process.exit(1)
    }

    const oldTenantId = workflow.tenant_id
    const newTenantId = user.customer_id

    console.log(`✓ Found workflow:`)
    console.log(`  - Workflow ID: ${workflow.workflow_id}`)
    console.log(`  - Name: ${workflow.workflow_name}`)
    console.log(`  - Template ID: ${workflow.template_id}`)
    console.log(`  - Current Tenant ID: ${oldTenantId}`)
    console.log(`  - New Tenant ID: ${newTenantId}`)

    if (oldTenantId === newTenantId) {
      console.log(`\n✓ Workflow already belongs to this user's customer_id`)
      return
    }

    // Step 3: Transfer workflow
    console.log('\nStep 3: Transferring workflow...')
    await docClient.send(new UpdateCommand({
      TableName: WORKFLOWS_TABLE,
      Key: { workflow_id: workflow.workflow_id },
      UpdateExpression: 'SET tenant_id = :tid, updated_at = :updated_at',
      ExpressionAttributeValues: {
        ':tid': newTenantId,
        ':updated_at': new Date().toISOString(),
      },
    }))
    console.log(`✓ Transferred workflow to customer_id: ${newTenantId}`)

    // Step 4: Transfer all jobs for this workflow
    console.log('\nStep 4: Transferring jobs...')
    let jobsTransferred = 0
    try {
      // Scan for jobs with this workflow_id
      const jobsScan = await docClient.send(new ScanCommand({
        TableName: JOBS_TABLE,
        FilterExpression: 'workflow_id = :wid',
        ExpressionAttributeValues: { ':wid': workflow.workflow_id },
      }))

      for (const job of jobsScan.Items || []) {
        if (job.tenant_id !== newTenantId) {
          await docClient.send(new UpdateCommand({
            TableName: JOBS_TABLE,
            Key: { job_id: job.job_id },
            UpdateExpression: 'SET tenant_id = :tid, updated_at = :updated_at',
            ExpressionAttributeValues: {
              ':tid': newTenantId,
              ':updated_at': new Date().toISOString(),
            },
          }))
          jobsTransferred++
        }
      }
      console.log(`✓ Transferred ${jobsTransferred} jobs`)
    } catch (error: any) {
      console.warn(`⚠️  Error transferring jobs: ${error.message}`)
    }

    // Step 5: Transfer form if it exists
    console.log('\nStep 5: Transferring form...')
    try {
      // Find form by workflow_id
      const formsScan = await docClient.send(new ScanCommand({
        TableName: FORMS_TABLE,
        FilterExpression: 'workflow_id = :wid',
        ExpressionAttributeValues: { ':wid': workflow.workflow_id },
        Limit: 1,
      }))

      const form = formsScan.Items?.[0]
      if (form && form.tenant_id !== newTenantId) {
        await docClient.send(new UpdateCommand({
          TableName: FORMS_TABLE,
          Key: { form_id: form.form_id },
          UpdateExpression: 'SET tenant_id = :tid, updated_at = :updated_at',
          ExpressionAttributeValues: {
            ':tid': newTenantId,
            ':updated_at': new Date().toISOString(),
          },
        }))
        console.log(`✓ Transferred form: ${form.form_name}`)
      } else if (form) {
        console.log(`✓ Form already belongs to this customer`)
      } else {
        console.log(`- No form found for this workflow`)
      }
    } catch (error: any) {
      console.warn(`⚠️  Error transferring form: ${error.message}`)
    }

    console.log('\n✅ Successfully completed!')
    console.log(`\n📋 Summary:`)
    console.log(`   Workflow: ${workflow.workflow_name}`)
    console.log(`   Workflow ID: ${workflow.workflow_id}`)
    console.log(`   Transferred from tenant_id: ${oldTenantId}`)
    console.log(`   Transferred to tenant_id: ${newTenantId}`)
    console.log(`   Jobs transferred: ${jobsTransferred}`)
    console.log(`\n💡 The workflow and all its jobs are now accessible to: ${email}`)

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
const workflowIdentifier = process.argv[2]
const email = process.argv[3]

if (!workflowIdentifier || !email) {
  console.error('Usage: npx tsx scripts/admin/transfer-workflow-to-user.ts <workflow_id_or_template_id> <email>')
  console.error('Example: npx tsx scripts/admin/transfer-workflow-to-user.ts tmpl_01KAHH0153BC1F556SNNVS3A9W marquez.joselitoken@gmail.com')
  process.exit(1)
}

transferWorkflowToUser(workflowIdentifier, email)
  .then(() => {
    console.log('\nDone!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })


