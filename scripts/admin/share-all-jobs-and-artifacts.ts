#!/usr/bin/env ts-node

/**
 * Script to share ALL jobs and ALL artifacts with a user
 * Usage: npx tsx scripts/admin/share-all-jobs-and-artifacts.ts <original_workflow_id> <email>
 * 
 * NOTE: For sharing everything (workflow + jobs + artifacts + submissions) in one go,
 * use share-workflow-complete.ts instead.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { CognitoIdentityProviderClient, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider'
import * as dotenv from 'dotenv'
import { ulid } from 'ulid'

dotenv.config()

const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || 'leadmagnet-workflows'
const JOBS_TABLE = process.env.JOBS_TABLE || 'leadmagnet-jobs'
const ARTIFACTS_TABLE = process.env.ARTIFACTS_TABLE || 'leadmagnet-artifacts'
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

async function getAllArtifactsForJob(jobId: string): Promise<any[]> {
  let allArtifacts: any[] = []
  let lastEvaluatedKey = undefined
  do {
    const queryParams: any = {
      TableName: ARTIFACTS_TABLE,
      IndexName: 'gsi_job_id',
      KeyConditionExpression: 'job_id = :jid',
      ExpressionAttributeValues: { ':jid': jobId },
    }
    if (lastEvaluatedKey) queryParams.ExclusiveStartKey = lastEvaluatedKey
    const query = await docClient.send(new QueryCommand(queryParams))
    allArtifacts = allArtifacts.concat(query.Items || [])
    lastEvaluatedKey = query.LastEvaluatedKey
  } while (lastEvaluatedKey)
  return allArtifacts
}

async function shareAllJobsAndArtifacts(workflowId: string, email: string) {
  try {
    console.log(`\n🚀 Sharing ALL jobs and artifacts with: ${email}`)
    console.log(`Original Workflow ID: ${workflowId}\n`)

    // Step 1: Find user
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
    let user = userQuery.Items?.[0]

    if (!user) {
      const scanResult = await docClient.send(new ScanCommand({
        TableName: USERS_TABLE,
        FilterExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': email },
        Limit: 1,
      }))
      user = scanResult.Items?.[0]
    }

    if (!user || !user.customer_id) {
      console.error(`❌ User not found: ${email}`)
      process.exit(1)
    }

    console.log(`✓ Found user: ${user.email} (customer_id: ${user.customer_id})`)

    // Step 2: Find workflows
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

    const sharedWorkflowScan = await docClient.send(new ScanCommand({
      TableName: WORKFLOWS_TABLE,
      FilterExpression: 'tenant_id = :tid',
      ExpressionAttributeValues: { ':tid': user.customer_id },
    }))
    const sharedWorkflow = sharedWorkflowScan.Items?.find((w: any) => 
      w.template_id === originalWorkflow.template_id
    )

    if (!sharedWorkflow) {
      console.error(`❌ Shared workflow not found`)
      process.exit(1)
    }

    console.log(`✓ Found workflows:`)
    console.log(`  - Original: ${originalWorkflow.workflow_id}`)
    console.log(`  - Shared: ${sharedWorkflow.workflow_id}`)

    // Step 3: Get all original jobs
    console.log(`\nStep 3: Finding all original jobs...`)
    const allOriginalJobs = await getAllItems<any>(
      JOBS_TABLE,
      'workflow_id = :wid',
      { ':wid': workflowId }
    )
    console.log(`✓ Found ${allOriginalJobs.length} original jobs`)

    // Step 4: Get all shared jobs
    console.log(`\nStep 4: Finding existing shared jobs...`)
    const allSharedJobs = await getAllItems<any>(
      JOBS_TABLE,
      'workflow_id = :wid',
      { ':wid': sharedWorkflow.workflow_id }
    )
    const existingSubmissionIds = new Set(
      allSharedJobs.map((j: any) => j.submission_id).filter(Boolean)
    )
    console.log(`✓ Found ${allSharedJobs.length} existing shared jobs`)

    // Step 5: Create missing shared jobs
    console.log(`\nStep 5: Creating missing shared jobs...`)
    const now = new Date().toISOString()
    let jobsCreated = 0
    const submissionIdToSharedJob = new Map<string, any>()

    // Add existing shared jobs to map
    for (const sharedJob of allSharedJobs) {
      if (sharedJob.submission_id) {
        submissionIdToSharedJob.set(sharedJob.submission_id, sharedJob)
      }
    }

    for (const originalJob of allOriginalJobs) {
      if (!originalJob.submission_id) {
        continue // Skip jobs without submission_id
      }

      if (existingSubmissionIds.has(originalJob.submission_id)) {
        continue // Already shared
      }

      const newJobId = `job_${ulid()}`
      const sharedJob = {
        ...originalJob,
        job_id: newJobId,
        workflow_id: sharedWorkflow.workflow_id,
        tenant_id: user.customer_id,
        created_at: originalJob.created_at || now,
        updated_at: now,
      }
      delete (sharedJob as any).deleted_at

      await docClient.send(new PutCommand({
        TableName: JOBS_TABLE,
        Item: sharedJob,
      }))

      submissionIdToSharedJob.set(originalJob.submission_id, sharedJob)
      jobsCreated++
    }

    console.log(`✓ Created ${jobsCreated} additional shared jobs`)
    console.log(`  Total shared jobs: ${submissionIdToSharedJob.size}`)

    // Step 6: Share all artifacts
    console.log(`\nStep 6: Sharing all artifacts...`)
    let totalArtifactsFound = 0
    let totalArtifactsShared = 0
    let totalArtifactsSkipped = 0

    for (const originalJob of allOriginalJobs) {
      if (!originalJob.submission_id) continue

      const sharedJob = submissionIdToSharedJob.get(originalJob.submission_id)
      if (!sharedJob) continue

      try {
        const artifacts = await getAllArtifactsForJob(originalJob.job_id)
        totalArtifactsFound += artifacts.length

        if (artifacts.length > 0) {
          console.log(`  Job ${originalJob.job_id.substring(0, 20)}...: ${artifacts.length} artifacts`)

          for (const artifact of artifacts) {
            // Check if artifact already exists
            const existingArtifactScan = await docClient.send(new ScanCommand({
              TableName: ARTIFACTS_TABLE,
              FilterExpression: 'job_id = :jid AND artifact_name = :aname',
              ExpressionAttributeValues: {
                ':jid': sharedJob.job_id,
                ':aname': artifact.artifact_name,
              },
              Limit: 1,
            }))

            if (existingArtifactScan.Items && existingArtifactScan.Items.length > 0) {
              totalArtifactsSkipped++
              continue
            }

            // Create shared artifact copy
            const sharedArtifactId = `art_${ulid()}`
            const sharedArtifact = {
              ...artifact,
              artifact_id: sharedArtifactId,
              job_id: sharedJob.job_id,
              tenant_id: user.customer_id,
              s3_key: artifact.s3_key,
              s3_url: artifact.s3_url,
              public_url: artifact.public_url,
              created_at: artifact.created_at,
            }

            await docClient.send(new PutCommand({
              TableName: ARTIFACTS_TABLE,
              Item: sharedArtifact,
            }))

            totalArtifactsShared++
          }
        }
      } catch (error: any) {
        console.warn(`  ⚠️  Error processing job ${originalJob.job_id}: ${error.message}`)
      }
    }

    console.log(`\n✅ Successfully completed!`)
    console.log(`\n📋 Final Summary:`)
    console.log(`   Original Jobs: ${allOriginalJobs.length}`)
    console.log(`   Shared Jobs Created: ${jobsCreated}`)
    console.log(`   Total Shared Jobs: ${submissionIdToSharedJob.size}`)
    console.log(`   Total Artifacts Found: ${totalArtifactsFound}`)
    console.log(`   Artifacts Shared: ${totalArtifactsShared}`)
    console.log(`   Artifacts Skipped: ${totalArtifactsSkipped}`)
    console.log(`\n💡 The user can now see:`)
    console.log(`   - All ${submissionIdToSharedJob.size} workflow runs`)
    console.log(`   - All ${totalArtifactsFound} artifacts from those runs`)
    console.log(`   - All future runs and artifacts (automatically shared)`)

  } catch (error: any) {
    console.error('\n❌ Error:', error)
    if (error.message) console.error('Error message:', error.message)
    process.exit(1)
  }
}

const workflowId = process.argv[2]
const email = process.argv[3]

if (!workflowId || !email) {
  console.error('Usage: npx tsx scripts/admin/share-all-jobs-and-artifacts.ts <original_workflow_id> <email>')
  process.exit(1)
}

shareAllJobsAndArtifacts(workflowId, email)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

