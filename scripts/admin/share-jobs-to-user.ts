#!/usr/bin/env ts-node

/**
 * Script to share all jobs from a workflow with a user
 * Usage: npx tsx scripts/admin/share-jobs-to-user.ts <workflow_id> <email>
 * 
 * NOTE: For sharing everything (workflow + jobs + artifacts + submissions) in one go,
 * use share-workflow-complete.ts instead.
 * 
 * This script:
 * 1. Finds all jobs for the original workflow
 * 2. Creates shared copies of each job with the user's customer_id
 * 3. Links them to the shared workflow copy
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { CognitoIdentityProviderClient, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider'
import * as dotenv from 'dotenv'
import { ulid } from 'ulid'

dotenv.config()

const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || 'leadmagnet-workflows'
const JOBS_TABLE = process.env.JOBS_TABLE || 'leadmagnet-jobs'
const USERS_TABLE = process.env.USERS_TABLE || 'leadmagnet-users'
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || process.env.USER_POOL_ID || 'us-east-1_asu0YOrBD'
const AWS_REGION = process.env.AWS_REGION || 'us-east-1'

const dynamoClient = new DynamoDBClient({ region: AWS_REGION })
const docClient = DynamoDBDocumentClient.from(dynamoClient)
const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION })

async function shareJobsToUser(workflowId: string, email: string) {
  try {
    console.log(`\n🚀 Sharing workflow jobs with user: ${email}`)
    console.log(`Workflow ID: ${workflowId}\n`)

    // Step 1: Find user
    console.log('Step 1: Finding user...')
    let user
    try {
      const cognitoUser = await cognitoClient.send(new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
      }))
      const userId = cognitoUser.Username!

      const userQuery = await docClient.send(new QueryCommand({
        TableName: USERS_TABLE,
        KeyConditionExpression: 'user_id = :uid',
        ExpressionAttributeValues: { ':uid': userId },
        Limit: 1,
      }))
      user = userQuery.Items?.[0]

      if (!user) {
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
    console.log(`  - Customer ID: ${user.customer_id}`)

    // Step 2: Find the shared workflow for this user
    console.log('\nStep 2: Finding shared workflow...')
    const workflowQuery = await docClient.send(new QueryCommand({
      TableName: WORKFLOWS_TABLE,
      KeyConditionExpression: 'workflow_id = :wid',
      ExpressionAttributeValues: { ':wid': workflowId },
      Limit: 1,
    }))
    const originalWorkflow = workflowQuery.Items?.[0]

    if (!originalWorkflow) {
      console.error(`❌ Original workflow not found: ${workflowId}`)
      process.exit(1)
    }

    // Find the shared workflow copy for this user
    const sharedWorkflowScan = await docClient.send(new ScanCommand({
      TableName: WORKFLOWS_TABLE,
      FilterExpression: 'tenant_id = :tid',
      ExpressionAttributeValues: {
        ':tid': user.customer_id,
      },
    }))

    // Find workflow with matching template_id
    const sharedWorkflow = sharedWorkflowScan.Items?.find((w: any) => 
      w.template_id === originalWorkflow.template_id
    )
    if (!sharedWorkflow) {
      console.error(`❌ Shared workflow not found for this user. Please run share-workflow-to-user.ts first.`)
      process.exit(1)
    }

    console.log(`✓ Found shared workflow:`)
    console.log(`  - Workflow ID: ${sharedWorkflow.workflow_id}`)
    console.log(`  - Name: ${sharedWorkflow.workflow_name}`)

    // Step 3: Find all jobs for the original workflow
    console.log('\nStep 3: Finding all jobs for original workflow...')
    const jobsScan = await docClient.send(new ScanCommand({
      TableName: JOBS_TABLE,
      FilterExpression: 'workflow_id = :wid',
      ExpressionAttributeValues: { ':wid': workflowId },
    }))

    const originalJobs = jobsScan.Items || []
    console.log(`✓ Found ${originalJobs.length} jobs`)

    if (originalJobs.length === 0) {
      console.log('\n✓ No jobs to share')
      return
    }

    // Step 4: Create shared copies of jobs
    console.log('\nStep 4: Creating shared copies of jobs...')
    const now = new Date().toISOString()
    let jobsShared = 0
    let jobsSkipped = 0

    for (const originalJob of originalJobs) {
      // Check if job already exists for this user
      const existingJobScan = await docClient.send(new ScanCommand({
        TableName: JOBS_TABLE,
        FilterExpression: 'workflow_id = :wid AND submission_id = :sid',
        ExpressionAttributeValues: {
          ':wid': sharedWorkflow.workflow_id,
          ':sid': originalJob.submission_id,
        },
        Limit: 1,
      }))

      if (existingJobScan.Items && existingJobScan.Items.length > 0) {
        jobsSkipped++
        continue
      }

      // Create shared job copy
      const newJobId = `job_${ulid()}`
      const sharedJob = {
        ...originalJob,
        job_id: newJobId,
        workflow_id: sharedWorkflow.workflow_id,
        tenant_id: user.customer_id,
        created_at: originalJob.created_at || now,
        updated_at: now,
      }

      // Remove any fields that shouldn't be copied
      delete (sharedJob as any).deleted_at

      await docClient.send(new PutCommand({
        TableName: JOBS_TABLE,
        Item: sharedJob,
      }))
      jobsShared++
    }

    console.log(`✓ Shared ${jobsShared} jobs`)
    if (jobsSkipped > 0) {
      console.log(`  (${jobsSkipped} jobs already existed)`)
    }

    console.log('\n✅ Successfully completed!')
    console.log(`\n📋 Summary:`)
    console.log(`   Original Workflow: ${originalWorkflow.workflow_name}`)
    console.log(`   Original Workflow ID: ${workflowId}`)
    console.log(`   Original Jobs: ${originalJobs.length}`)
    console.log(`   ──────────────────────────────────────`)
    console.log(`   Shared Workflow ID: ${sharedWorkflow.workflow_id}`)
    console.log(`   Shared Tenant ID: ${user.customer_id}`)
    console.log(`   Jobs Shared: ${jobsShared}`)
    console.log(`   Shared with: ${email}`)
    console.log(`\n💡 The user can now see all ${originalJobs.length} workflow runs in their account`)

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
const workflowId = process.argv[2]
const email = process.argv[3]

if (!workflowId || !email) {
  console.error('Usage: npx tsx scripts/admin/share-jobs-to-user.ts <workflow_id> <email>')
  console.error('Example: npx tsx scripts/admin/share-jobs-to-user.ts wf_01KAHH0134PC5EB380Z36VW4QJ marquez.joselitoken@gmail.com')
  process.exit(1)
}

shareJobsToUser(workflowId, email)
  .then(() => {
    console.log('\nDone!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

