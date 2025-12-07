#!/usr/bin/env ts-node

/**
 * Comprehensive script to share a workflow and ALL associated data with a user
 * This includes: workflow, jobs, artifacts, and form submissions
 * 
 * Usage: npx tsx scripts/admin/share-workflow-complete.ts <workflow_id_or_template_id> <email>
 * 
 * This script:
 * 1. Shares the workflow (creates a copy for the user)
 * 2. Shares all existing jobs
 * 3. Shares all existing artifacts
 * 4. Shares all existing form submissions
 * 
 * Future jobs, artifacts, and submissions will be automatically shared via the workflowSharingService
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, QueryCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { CognitoIdentityProviderClient, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider'
import * as dotenv from 'dotenv'
import { ulid } from 'ulid'

dotenv.config()

const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || 'leadmagnet-workflows'
const JOBS_TABLE = process.env.JOBS_TABLE || 'leadmagnet-jobs'
const ARTIFACTS_TABLE = process.env.ARTIFACTS_TABLE || 'leadmagnet-artifacts'
const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE || 'leadmagnet-submissions'
const FORMS_TABLE = process.env.FORMS_TABLE || 'leadmagnet-forms'
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

async function shareWorkflowComplete(workflowIdentifier: string, email: string) {
  try {
    console.log(`\n🚀 Sharing workflow and ALL data with: ${email}`)
    console.log(`Workflow/Template ID: ${workflowIdentifier}\n`)

    // Step 1: Find user
    console.log('Step 1: Finding user...')
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
      console.error(`❌ User not found or missing customer_id: ${email}`)
      process.exit(1)
    }

    console.log(`✓ Found user: ${user.email} (customer_id: ${user.customer_id})`)

    // Step 2: Find or create shared workflow
    console.log('\nStep 2: Finding or creating shared workflow...')
    let originalWorkflow
    let templateId: string | undefined

    if (workflowIdentifier.startsWith('tmpl_')) {
      // Find workflow by template_id
      templateId = workflowIdentifier
      const workflowScan = await docClient.send(new ScanCommand({
        TableName: WORKFLOWS_TABLE,
        FilterExpression: 'template_id = :tid',
        ExpressionAttributeValues: { ':tid': templateId },
        Limit: 1,
      }))
      originalWorkflow = workflowScan.Items?.[0]
    } else {
      // Find workflow by workflow_id
      originalWorkflow = await docClient.send(new QueryCommand({
        TableName: WORKFLOWS_TABLE,
        KeyConditionExpression: 'workflow_id = :wid',
        ExpressionAttributeValues: { ':wid': workflowIdentifier },
        Limit: 1,
      })).then(r => r.Items?.[0])
      templateId = originalWorkflow?.template_id
    }

    if (!originalWorkflow || !templateId) {
      console.error(`❌ Workflow not found: ${workflowIdentifier}`)
      process.exit(1)
    }

    // Check if shared workflow already exists
    const sharedWorkflowScan = await docClient.send(new ScanCommand({
      TableName: WORKFLOWS_TABLE,
      FilterExpression: 'tenant_id = :tid AND template_id = :template',
      ExpressionAttributeValues: {
        ':tid': user.customer_id,
        ':template': templateId,
      },
      Limit: 1,
    }))
    let sharedWorkflow = sharedWorkflowScan.Items?.[0]

    if (!sharedWorkflow) {
      console.log('  Creating shared workflow copy...')
      const sharedWorkflowId = `wf_${ulid()}`
      sharedWorkflow = {
        ...originalWorkflow,
        workflow_id: sharedWorkflowId,
        tenant_id: user.customer_id,
        created_at: originalWorkflow.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      delete (sharedWorkflow as any).deleted_at

      await docClient.send(new PutCommand({
        TableName: WORKFLOWS_TABLE,
        Item: sharedWorkflow,
      }))

      // Share form if it exists
      if (originalWorkflow.form_id) {
        const originalForm = await docClient.send(new QueryCommand({
          TableName: FORMS_TABLE,
          KeyConditionExpression: 'form_id = :fid',
          ExpressionAttributeValues: { ':fid': originalWorkflow.form_id },
          Limit: 1,
        })).then(r => r.Items?.[0])

        if (originalForm) {
          const sharedFormId = `form_${ulid()}`
          const sharedForm = {
            ...originalForm,
            form_id: sharedFormId,
            workflow_id: sharedWorkflowId,
            tenant_id: user.customer_id,
            created_at: originalForm.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          delete (sharedForm as any).deleted_at

          await docClient.send(new PutCommand({
            TableName: FORMS_TABLE,
            Item: sharedForm,
          }))

          await docClient.send(new UpdateCommand({
            TableName: WORKFLOWS_TABLE,
            Key: { workflow_id: sharedWorkflowId },
            UpdateExpression: 'SET form_id = :fid',
            ExpressionAttributeValues: { ':fid': sharedFormId },
          }))
          sharedWorkflow.form_id = sharedFormId
        }
      }
    }

    console.log(`✓ Shared workflow: ${sharedWorkflow.workflow_id}`)

    // Step 3: Share all jobs
    console.log('\nStep 3: Sharing jobs...')
    const allOriginalJobs = await getAllItems<any>(
      JOBS_TABLE,
      'workflow_id = :wid',
      { ':wid': originalWorkflow.workflow_id }
    )
    console.log(`  Found ${allOriginalJobs.length} original jobs`)

    const allSharedJobs = await getAllItems<any>(
      JOBS_TABLE,
      'workflow_id = :wid',
      { ':wid': sharedWorkflow.workflow_id }
    )
    const existingSubmissionIds = new Set(
      allSharedJobs.map((j: any) => j.submission_id).filter(Boolean)
    )

    const now = new Date().toISOString()
    let jobsCreated = 0
    const submissionIdToSharedJob = new Map<string, any>()

    for (const sharedJob of allSharedJobs) {
      if (sharedJob.submission_id) {
        submissionIdToSharedJob.set(sharedJob.submission_id, sharedJob)
      }
    }

    for (const originalJob of allOriginalJobs) {
      if (!originalJob.submission_id) continue
      if (existingSubmissionIds.has(originalJob.submission_id)) continue

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

    console.log(`✓ Created ${jobsCreated} shared jobs (total: ${submissionIdToSharedJob.size})`)

    // Step 4: Share all submissions
    console.log('\nStep 4: Sharing form submissions...')
    const allOriginalSubmissions = await getAllItems<any>(
      SUBMISSIONS_TABLE,
      'workflow_id = :wid',
      { ':wid': originalWorkflow.workflow_id }
    )
    console.log(`  Found ${allOriginalSubmissions.length} original submissions`)

    let submissionsShared = 0
    for (const originalSubmission of allOriginalSubmissions) {
      const sharedJob = submissionIdToSharedJob.get(originalSubmission.submission_id)
      if (!sharedJob) continue

      // Check if submission already exists
      const existingScan = await docClient.send(new ScanCommand({
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

      if (existingScan.Items && existingScan.Items.length > 0) {
        const existing = existingScan.Items[0]
        await docClient.send(new UpdateCommand({
          TableName: JOBS_TABLE,
          Key: { job_id: sharedJob.job_id },
          UpdateExpression: 'SET submission_id = :sid, updated_at = :updated',
          ExpressionAttributeValues: {
            ':sid': existing.submission_id,
            ':updated': now,
          },
        }))
        continue
      }

      const newSubmissionId = `sub_${ulid()}`
      const sharedSubmission = {
        ...originalSubmission,
        submission_id: newSubmissionId,
        tenant_id: user.customer_id,
        workflow_id: sharedWorkflow.workflow_id,
        form_id: sharedWorkflow.form_id || originalSubmission.form_id,
        job_id: sharedJob.job_id,
        created_at: originalSubmission.created_at || now,
        ttl: originalSubmission.ttl,
      }
      delete (sharedSubmission as any).deleted_at

      await docClient.send(new PutCommand({
        TableName: SUBMISSIONS_TABLE,
        Item: sharedSubmission,
      }))

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
    }

    console.log(`✓ Shared ${submissionsShared} submissions`)

    // Step 5: Share all artifacts
    console.log('\nStep 5: Sharing artifacts...')
    let totalArtifactsFound = 0
    let totalArtifactsShared = 0

    for (const originalJob of allOriginalJobs) {
      if (!originalJob.submission_id) continue

      const sharedJob = submissionIdToSharedJob.get(originalJob.submission_id)
      if (!sharedJob) continue

      try {
        const artifacts = await getAllArtifactsForJob(originalJob.job_id)
        totalArtifactsFound += artifacts.length

        for (const artifact of artifacts) {
          const existingScan = await docClient.send(new ScanCommand({
            TableName: ARTIFACTS_TABLE,
            FilterExpression: 'job_id = :jid AND artifact_name = :aname',
            ExpressionAttributeValues: {
              ':jid': sharedJob.job_id,
              ':aname': artifact.artifact_name,
            },
            Limit: 1,
          }))

          if (existingScan.Items && existingScan.Items.length > 0) {
            continue
          }

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
      } catch (error: any) {
        console.warn(`  ⚠️  Error processing job ${originalJob.job_id.substring(0, 20)}...: ${error.message}`)
      }
    }

    console.log(`✓ Shared ${totalArtifactsShared} artifacts (found ${totalArtifactsFound} total)`)

    console.log('\n✅ Successfully completed!')
    console.log(`\n📋 Summary:`)
    console.log(`   Workflow: ${originalWorkflow.workflow_name}`)
    console.log(`   Original Workflow ID: ${originalWorkflow.workflow_id}`)
    console.log(`   Shared Workflow ID: ${sharedWorkflow.workflow_id}`)
    console.log(`   ──────────────────────────────────────`)
    console.log(`   Jobs Shared: ${submissionIdToSharedJob.size}`)
    console.log(`   Submissions Shared: ${submissionsShared}`)
    console.log(`   Artifacts Shared: ${totalArtifactsShared}`)
    console.log(`   Shared with: ${email}`)
    console.log(`\n💡 Future jobs, artifacts, and submissions will be automatically shared`)

  } catch (error: any) {
    console.error('\n❌ Error:', error)
    if (error.message) console.error('Error message:', error.message)
    process.exit(1)
  }
}

const workflowId = process.argv[2]
const email = process.argv[3]

if (!workflowId || !email) {
  console.error('Usage: npx tsx scripts/admin/share-workflow-complete.ts <workflow_id_or_template_id> <email>')
  console.error('Example: npx tsx scripts/admin/share-workflow-complete.ts wf_01KAHH0134PC5EB380Z36VW4QJ marquez.joselitoken@gmail.com')
  process.exit(1)
}

shareWorkflowComplete(workflowId, email)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })


