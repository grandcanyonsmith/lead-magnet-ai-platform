#!/usr/bin/env ts-node

/**
 * Script to share a workflow with a user by duplicating it to their customer_id
 * Usage: npx tsx scripts/admin/share-workflow-to-user.ts <workflow_id_or_template_id> <email>
 * 
 * This script:
 * 1. Finds the workflow by workflow_id or template_id
 * 2. Finds the user by email
 * 3. Creates a duplicate of the workflow with the user's customer_id
 * 4. The original workflow remains with its original owner
 * 5. Both customers can now access the workflow
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { CognitoIdentityProviderClient, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider'
import * as dotenv from 'dotenv'
import { ulid } from 'ulid'

dotenv.config()

const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || 'leadmagnet-workflows'
const FORMS_TABLE = process.env.FORMS_TABLE || 'leadmagnet-forms'
const USERS_TABLE = process.env.USERS_TABLE || 'leadmagnet-users'
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || process.env.USER_POOL_ID || 'us-east-1_asu0YOrBD'
const AWS_REGION = process.env.AWS_REGION || 'us-east-1'

const dynamoClient = new DynamoDBClient({ region: AWS_REGION })
const docClient = DynamoDBDocumentClient.from(dynamoClient)
const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION })

async function shareWorkflowToUser(workflowIdentifier: string, email: string) {
  try {
    console.log(`\n🚀 Sharing workflow with user: ${email}`)
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

    const originalTenantId = workflow.tenant_id
    const newTenantId = user.customer_id

    console.log(`✓ Found workflow:`)
    console.log(`  - Workflow ID: ${workflow.workflow_id}`)
    console.log(`  - Name: ${workflow.workflow_name}`)
    console.log(`  - Template ID: ${workflow.template_id}`)
    console.log(`  - Original Tenant ID: ${originalTenantId}`)
    console.log(`  - Sharing with Tenant ID: ${newTenantId}`)

    // Check if workflow already exists for this customer
    const existingCheck = await docClient.send(new ScanCommand({
      TableName: WORKFLOWS_TABLE,
      FilterExpression: 'template_id = :tid AND tenant_id = :tid2',
      ExpressionAttributeValues: {
        ':tid': workflow.template_id,
        ':tid2': newTenantId,
      },
      Limit: 1,
    }))

    if (existingCheck.Items && existingCheck.Items.length > 0) {
      console.log(`\n✓ Workflow already shared with this customer`)
      console.log(`  Existing workflow ID: ${existingCheck.Items[0].workflow_id}`)
      return
    }

    // Step 3: Create shared copy of workflow
    console.log('\nStep 3: Creating shared copy of workflow...')
    const now = new Date().toISOString()
    const newWorkflowId = `wf_${ulid()}`
    
    // Create a copy of the workflow with new tenant_id
    const sharedWorkflow = {
      ...workflow,
      workflow_id: newWorkflowId,
      tenant_id: newTenantId,
      created_at: now,
      updated_at: now,
      // Remove any deleted_at if present
      deleted_at: undefined,
    }

    await docClient.send(new PutCommand({
      TableName: WORKFLOWS_TABLE,
      Item: sharedWorkflow,
    }))
    console.log(`✓ Created shared workflow copy`)
    console.log(`  - New Workflow ID: ${newWorkflowId}`)
    console.log(`  - Tenant ID: ${newTenantId}`)

    // Step 4: Share form if it exists
    console.log('\nStep 4: Sharing form...')
    try {
      // Find form by workflow_id (original)
      const formsScan = await docClient.send(new ScanCommand({
        TableName: FORMS_TABLE,
        FilterExpression: 'workflow_id = :wid',
        ExpressionAttributeValues: { ':wid': workflow.workflow_id },
        Limit: 1,
      }))

      const form = formsScan.Items?.[0]
      if (form) {
        // Check if form already exists for new tenant
        const existingFormCheck = await docClient.send(new ScanCommand({
          TableName: FORMS_TABLE,
          FilterExpression: 'public_slug = :slug AND tenant_id = :tid',
          ExpressionAttributeValues: {
            ':slug': form.public_slug,
            ':tid': newTenantId,
          },
          Limit: 1,
        }))

        if (!existingFormCheck.Items || existingFormCheck.Items.length === 0) {
          // Create shared form copy
          const newFormId = `form_${ulid()}`
          const sharedForm = {
            ...form,
            form_id: newFormId,
            workflow_id: newWorkflowId,
            tenant_id: newTenantId,
            created_at: now,
            updated_at: now,
            deleted_at: undefined,
          }

          await docClient.send(new PutCommand({
            TableName: FORMS_TABLE,
            Item: sharedForm,
          }))
          console.log(`✓ Created shared form copy`)
          console.log(`  - Form Name: ${form.form_name}`)
          console.log(`  - Public Slug: ${form.public_slug}`)
        } else {
          console.log(`✓ Form already exists for this customer`)
        }
      } else {
        console.log(`- No form found for this workflow`)
      }
    } catch (error: any) {
      console.warn(`⚠️  Error sharing form: ${error.message}`)
    }

    console.log('\n✅ Successfully completed!')
    console.log(`\n📋 Summary:`)
    console.log(`   Original Workflow: ${workflow.workflow_name}`)
    console.log(`   Original Workflow ID: ${workflow.workflow_id}`)
    console.log(`   Original Tenant ID: ${originalTenantId}`)
    console.log(`   ──────────────────────────────────────`)
    console.log(`   Shared Workflow ID: ${newWorkflowId}`)
    console.log(`   Shared Tenant ID: ${newTenantId}`)
    console.log(`   Shared with: ${email}`)
    console.log(`\n💡 The workflow is now accessible to both customers:`)
    console.log(`   - Original owner: ${originalTenantId}`)
    console.log(`   - Shared with: ${newTenantId} (${email})`)

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
  console.error('Usage: npx tsx scripts/admin/share-workflow-to-user.ts <workflow_id_or_template_id> <email>')
  console.error('Example: npx tsx scripts/admin/share-workflow-to-user.ts tmpl_01KAHH0153BC1F556SNNVS3A9W marquez.joselitoken@gmail.com')
  process.exit(1)
}

shareWorkflowToUser(workflowIdentifier, email)
  .then(() => {
    console.log('\nDone!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

