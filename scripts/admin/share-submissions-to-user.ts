#!/usr/bin/env ts-node

/**
 * Script to share all form submissions from a workflow with a user
 * Usage: npx tsx scripts/admin/share-submissions-to-user.ts <workflow_id> <email>
 * 
 * NOTE: For sharing everything (workflow + jobs + artifacts + submissions) in one go,
 * use share-workflow-complete.ts instead.
 * 
 * This script:
 * 1. Finds all submissions for the original workflow
 * 2. Creates shared copies of each submission with the user's customer_id
 * 3. Updates shared jobs to reference the new shared submission_ids
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, QueryCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { CognitoIdentityProviderClient, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider'
import * as dotenv from 'dotenv'
import { ulid } from 'ulid'

dotenv.config()

const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || 'leadmagnet-workflows'
const JOBS_TABLE = process.env.JOBS_TABLE || 'leadmagnet-jobs'
const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE || 'leadmagnet-submissions'
const USERS_TABLE = process.env.USERS_TABLE || 'leadmagnet-users'
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || process.env.USER_POOL_ID || 'us-east-1_asu0YOrBD'
const AWS_REGION = process.env.AWS_REGION || 'us-east-1'

const dynamoClient = new DynamoDBClient({ region: AWS_REGION })
const docClient = DynamoDBDocumentClient.from(dynamoClient)
const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION })

async function getAllItems<T>(tableName: string, filterExpression: string, expressionValues: Record<string, any>): Promise<T[]> {
  let allItems: T[] = []
  let lastEvaluatedKey = undefined
  do {
    const scanParams: any = {
      TableName: tableName,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionValues,
    }
    if (lastEvaluatedKey) scanParams.ExclusiveStartKey = lastEvaluatedKey
    const scan = await docClient.send(new ScanCommand(scanParams))
    allItems = allItems.concat((scan.Items || []) as T[])
    lastEvaluatedKey = scan.LastEvaluatedKey
  } while (lastEvaluatedKey)
  return allItems
}

async function shareSubmissionsToUser(workflowId: string, email: string) {
  try {
    console.log(`\n🚀 Sharing form submissions with user: ${email}`)
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
    console.log('\nStep 2: Finding workflows...')
    const originalWorkflow = await docClient.send(new QueryCommand({
      TableName: WORKFLOWS_TABLE,
      KeyConditionExpression: 'workflow_id = :wid',
      ExpressionAttributeValues: { ':wid': workflowId },
      Limit: 1,
    })).then(r => r.Items?.[0])

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

    console.log(`✓ Found workflows:`)
    console.log(`  - Original: ${originalWorkflow.workflow_id}`)
    console.log(`  - Shared: ${sharedWorkflow.workflow_id}`)

    // Step 3: Find all submissions for the original workflow
    console.log('\nStep 3: Finding all submissions for original workflow...')
    const allOriginalSubmissions = await getAllItems<any>(
      SUBMISSIONS_TABLE,
      'workflow_id = :wid',
      { ':wid': workflowId }
    )
    console.log(`✓ Found ${allOriginalSubmissions.length} original submissions`)

    if (allOriginalSubmissions.length === 0) {
      console.log('\n✓ No submissions to share')
      return
    }

    // Step 4: Find all shared jobs
    console.log('\nStep 4: Finding shared jobs...')
    const allSharedJobs = await getAllItems<any>(
      JOBS_TABLE,
      'workflow_id = :wid',
      { ':wid': sharedWorkflow.workflow_id }
    )
    console.log(`✓ Found ${allSharedJobs.length} shared jobs`)

    // Create mapping: original submission_id -> shared job
    const originalSubmissionIdToSharedJob = new Map<string, any>()
    for (const sharedJob of allSharedJobs) {
      if (sharedJob.submission_id) {
        originalSubmissionIdToSharedJob.set(sharedJob.submission_id, sharedJob)
      }
    }
    console.log(`  Mapped ${originalSubmissionIdToSharedJob.size} jobs by submission_id`)

    // Step 5: Create shared copies of submissions and update jobs
    console.log('\nStep 5: Creating shared submissions and updating jobs...')
    const now = new Date().toISOString()
    let submissionsShared = 0
    let submissionsSkipped = 0
    let jobsUpdated = 0

    // First, check which submissions already exist for this user
    const existingSubmissionsScan = await docClient.send(new ScanCommand({
      TableName: SUBMISSIONS_TABLE,
      FilterExpression: 'tenant_id = :tid',
      ExpressionAttributeValues: {
        ':tid': user.customer_id,
      },
    }))
    const existingSubmissionIds = new Set(
      existingSubmissionsScan.Items?.map((s: any) => s.submission_id) || []
    )

    for (const originalSubmission of allOriginalSubmissions) {
      // Check if a shared submission already exists (by checking if we already created one for this original)
      // We'll check by looking for submissions with same workflow_id and similar data
      const existingSharedSubmissionScan = await docClient.send(new ScanCommand({
        TableName: SUBMISSIONS_TABLE,
        FilterExpression: 'tenant_id = :tid AND workflow_id = :wid AND submitter_email = :email AND created_at = :created',
        ExpressionAttributeValues: {
          ':tid': user.customer_id,
          ':wid': sharedWorkflow.workflow_id,
          ':email': originalSubmission.submitter_email,
          ':created': originalSubmission.created_at,
        },
        Limit: 1,
      }))

      if (existingSharedSubmissionScan.Items && existingSharedSubmissionScan.Items.length > 0) {
        submissionsSkipped++
        // Still update the job if needed
        const sharedJob = originalSubmissionIdToSharedJob.get(originalSubmission.submission_id)
        if (sharedJob && sharedJob.submission_id === originalSubmission.submission_id) {
          // Job still references original submission_id, update it
          const existingSharedSubmission = existingSharedSubmissionScan.Items[0]
          await docClient.send(new UpdateCommand({
            TableName: JOBS_TABLE,
            Key: { job_id: sharedJob.job_id },
            UpdateExpression: 'SET submission_id = :sid, updated_at = :updated',
            ExpressionAttributeValues: {
              ':sid': existingSharedSubmission.submission_id,
              ':updated': now,
            },
          }))
          jobsUpdated++
        }
        continue
      }

      // Find the shared job that references this submission
      const sharedJob = originalSubmissionIdToSharedJob.get(originalSubmission.submission_id)
      if (!sharedJob) {
        console.log(`  ⚠️  No shared job found for submission ${originalSubmission.submission_id.substring(0, 20)}...`)
        continue
      }

      // Create shared submission copy
      const newSubmissionId = `sub_${ulid()}`
      const sharedSubmission = {
        ...originalSubmission,
        submission_id: newSubmissionId,
        tenant_id: user.customer_id,
        workflow_id: sharedWorkflow.workflow_id,
        form_id: sharedWorkflow.form_id || originalSubmission.form_id, // Use shared workflow's form_id if available
        job_id: sharedJob.job_id, // Link to shared job
        created_at: originalSubmission.created_at || now,
        // Keep TTL if it exists
        ttl: originalSubmission.ttl,
      }

      // Remove any fields that shouldn't be copied
      delete (sharedSubmission as any).deleted_at

      await docClient.send(new PutCommand({
        TableName: SUBMISSIONS_TABLE,
        Item: sharedSubmission,
      }))

      // Update shared job to reference the new submission_id
      await docClient.send(new UpdateCommand({
        TableName: JOBS_TABLE,
        Key: { job_id: sharedJob.job_id },
        UpdateExpression: 'SET submission_id = :sid, updated_at = :updated',
        ExpressionAttributeValues: {
          ':sid': newSubmissionId,
          ':updated': now,
        },
      }))

      submissionsShared++
      jobsUpdated++
    }

    console.log(`✓ Shared ${submissionsShared} submissions`)
    if (submissionsSkipped > 0) {
      console.log(`  (${submissionsSkipped} submissions already existed)`)
    }
    console.log(`✓ Updated ${jobsUpdated} jobs to reference shared submissions`)

    console.log('\n✅ Successfully completed!')
    console.log(`\n📋 Summary:`)
    console.log(`   Original Workflow: ${originalWorkflow.workflow_name}`)
    console.log(`   Original Workflow ID: ${workflowId}`)
    console.log(`   Original Submissions: ${allOriginalSubmissions.length}`)
    console.log(`   ──────────────────────────────────────`)
    console.log(`   Shared Workflow ID: ${sharedWorkflow.workflow_id}`)
    console.log(`   Shared Tenant ID: ${user.customer_id}`)
    console.log(`   Submissions Shared: ${submissionsShared}`)
    console.log(`   Jobs Updated: ${jobsUpdated}`)
    console.log(`   Shared with: ${email}`)
    console.log(`\n💡 The user can now see all ${allOriginalSubmissions.length} form submissions in their account`)

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
  console.error('Usage: npx tsx scripts/admin/share-submissions-to-user.ts <workflow_id> <email>')
  console.error('Example: npx tsx scripts/admin/share-submissions-to-user.ts wf_01KAHH0134PC5EB380Z36VW4QJ marquez.joselitoken@gmail.com')
  process.exit(1)
}

shareSubmissionsToUser(workflowId, email)
  .then(() => {
    console.log('\nDone!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

