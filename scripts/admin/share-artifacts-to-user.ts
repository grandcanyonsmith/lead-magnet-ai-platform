#!/usr/bin/env ts-node

/**
 * Script to share all artifacts from jobs with a user
 * Usage: npx tsx scripts/admin/share-artifacts-to-user.ts <workflow_id> <email>
 * 
 * NOTE: For sharing everything (workflow + jobs + artifacts + submissions) in one go,
 * use share-workflow-complete.ts instead.
 * 
 * This script:
 * 1. Finds all jobs for the original workflow
 * 2. Finds all artifacts for those jobs
 * 3. Creates shared artifact copies for the shared workflow jobs
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

async function shareArtifactsToUser(workflowId: string, email: string) {
  try {
    console.log(`\n🚀 Sharing all artifacts with user: ${email}`)
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

    // Step 2: Find the shared workflow
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

    // Step 3: Find all jobs for original workflow
    console.log('\nStep 3: Finding all jobs for original workflow...')
    const originalJobsScan = await docClient.send(new ScanCommand({
      TableName: JOBS_TABLE,
      FilterExpression: 'workflow_id = :wid',
      ExpressionAttributeValues: { ':wid': workflowId },
    }))

    const originalJobs = originalJobsScan.Items || []
    console.log(`✓ Found ${originalJobs.length} jobs`)

    if (originalJobs.length === 0) {
      console.log('\n✓ No jobs to process')
      return
    }

    // Step 4: Find shared jobs and create a mapping
    console.log('\nStep 4: Finding shared jobs...')
    // Use multiple scans to ensure we get all jobs (DynamoDB scan can be paginated)
    let sharedJobs: any[] = []
    let lastEvaluatedKey = undefined
    do {
      const scanParams: any = {
        TableName: JOBS_TABLE,
        FilterExpression: 'workflow_id = :wid',
        ExpressionAttributeValues: { ':wid': sharedWorkflow.workflow_id },
      }
      if (lastEvaluatedKey) {
        scanParams.ExclusiveStartKey = lastEvaluatedKey
      }
      const sharedJobsScan = await docClient.send(new ScanCommand(scanParams))
      sharedJobs = sharedJobs.concat(sharedJobsScan.Items || [])
      lastEvaluatedKey = sharedJobsScan.LastEvaluatedKey
    } while (lastEvaluatedKey)
    
    // Create mapping: original submission_id -> shared job
    const submissionIdToSharedJob = new Map<string, any>()
    for (const sharedJob of sharedJobs) {
      if (sharedJob.submission_id) {
        submissionIdToSharedJob.set(sharedJob.submission_id, sharedJob)
      }
    }

    console.log(`✓ Found ${sharedJobs.length} shared jobs`)
    console.log(`  Mapping ${submissionIdToSharedJob.size} jobs by submission_id`)

    // Step 5: Find all artifacts for original jobs and share them
    console.log('\nStep 5: Finding and sharing artifacts...')
    let totalArtifacts = 0
    let sharedArtifacts = 0
    let skippedArtifacts = 0

    for (const originalJob of originalJobs) {
      if (!originalJob.submission_id) {
        continue
      }

      const sharedJob = submissionIdToSharedJob.get(originalJob.submission_id)
      if (!sharedJob) {
        // No shared job found, skip
        continue
      }

      // Find all artifacts for this original job
      try {
        const artifactsQuery = await docClient.send(new QueryCommand({
          TableName: ARTIFACTS_TABLE,
          IndexName: 'gsi_job_id',
          KeyConditionExpression: 'job_id = :jid',
          ExpressionAttributeValues: { ':jid': originalJob.job_id },
        }))

        const artifacts = artifactsQuery.Items || []
        totalArtifacts += artifacts.length

        for (const artifact of artifacts) {
          // Check if artifact already exists for shared job
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
            skippedArtifacts++
            continue
          }

          // Create shared artifact copy
          const sharedArtifactId = `art_${ulid()}`
          const sharedArtifact = {
            ...artifact,
            artifact_id: sharedArtifactId,
            job_id: sharedJob.job_id,
            tenant_id: user.customer_id,
            // Keep the same S3 key/URL so both artifacts point to the same file
            s3_key: artifact.s3_key,
            s3_url: artifact.s3_url,
            public_url: artifact.public_url,
            created_at: artifact.created_at,
          }

          await docClient.send(new PutCommand({
            TableName: ARTIFACTS_TABLE,
            Item: sharedArtifact,
          }))

          sharedArtifacts++
        }
      } catch (error: any) {
        console.warn(`⚠️  Error processing artifacts for job ${originalJob.job_id}: ${error.message}`)
      }
    }

    console.log(`✓ Processed artifacts:`)
    console.log(`  - Total artifacts found: ${totalArtifacts}`)
    console.log(`  - Artifacts shared: ${sharedArtifacts}`)
    console.log(`  - Artifacts skipped (already exist): ${skippedArtifacts}`)

    console.log('\n✅ Successfully completed!')
    console.log(`\n📋 Summary:`)
    console.log(`   Original Workflow: ${originalWorkflow.workflow_name}`)
    console.log(`   Original Workflow ID: ${workflowId}`)
    console.log(`   Original Jobs: ${originalJobs.length}`)
    console.log(`   ──────────────────────────────────────`)
    console.log(`   Shared Workflow ID: ${sharedWorkflow.workflow_id}`)
    console.log(`   Shared Tenant ID: ${user.customer_id}`)
    console.log(`   Total Artifacts: ${totalArtifacts}`)
    console.log(`   Artifacts Shared: ${sharedArtifacts}`)
    console.log(`   Shared with: ${email}`)
    console.log(`\n💡 The user can now see all ${totalArtifacts} artifacts from all workflow runs`)

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
  console.error('Usage: npx tsx scripts/admin/share-artifacts-to-user.ts <workflow_id> <email>')
  console.error('Example: npx tsx scripts/admin/share-artifacts-to-user.ts wf_01KAHH0134PC5EB380Z36VW4QJ marquez.joselitoken@gmail.com')
  process.exit(1)
}

shareArtifactsToUser(workflowId, email)
  .then(() => {
    console.log('\nDone!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

