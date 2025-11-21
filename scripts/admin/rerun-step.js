#!/usr/bin/env node

/**
 * Script to rerun a specific step in a job
 * Usage: node scripts/admin/rerun-step.js <job-id> <step-index>
 * Or: node scripts/admin/rerun-step.js <workflow-id> <step-index> (finds most recent job)
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb')
const https = require('https')
require('dotenv').config()

const JOBS_TABLE = process.env.JOBS_TABLE || 'leadmagnet-jobs'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://czp5b77azd.execute-api.us-east-1.amazonaws.com'

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
const docClient = DynamoDBDocumentClient.from(dynamoClient)

async function findMostRecentJob(workflowId) {
  try {
    const { ScanCommand } = require('@aws-sdk/lib-dynamodb')
    const result = await docClient.send(new ScanCommand({
      TableName: JOBS_TABLE,
      FilterExpression: 'workflow_id = :workflow_id',
      ExpressionAttributeValues: {
        ':workflow_id': workflowId,
      },
    }))

    if (!result.Items || result.Items.length === 0) {
      return null
    }

    // Sort by created_at descending and return most recent
    const sorted = result.Items.sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime()
      const bTime = new Date(b.created_at || 0).getTime()
      return bTime - aTime
    })

    return sorted[0]
  } catch (error) {
    console.error('Error finding job:', error.message)
    return null
  }
}

async function rerunStep(jobId, stepIndex, tenantId) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_URL}/admin/jobs/${jobId}/rerun-step`)
    
    const data = JSON.stringify({
      step_index: stepIndex,
    })

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        // Note: In production, you'd need to add Authorization header
        // For now, this assumes the API allows unauthenticated requests or uses a different auth method
      },
    }

    const req = https.request(url, options, (res) => {
      let responseData = ''

      res.on('data', (chunk) => {
        responseData += chunk
      })

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(responseData)
            resolve(parsed)
          } catch (e) {
            resolve({ message: responseData })
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.write(data)
    req.end()
  })
}

async function main() {
  const workflowIdOrJobId = process.argv[2]
  const stepIndexStr = process.argv[3]

  if (!workflowIdOrJobId || !stepIndexStr) {
    console.error('Usage: node scripts/admin/rerun-step.js <job-id-or-workflow-id> <step-index>')
    console.error('Example: node scripts/admin/rerun-step.js wf_01KAJXM6FVF93HKCS62VDQCHCW 11')
    process.exit(1)
  }

  const stepIndex = parseInt(stepIndexStr, 10)
  if (isNaN(stepIndex)) {
    console.error('Error: Step index must be a number')
    process.exit(1)
  }

  let jobId = workflowIdOrJobId
  let tenantId = null

  // If it's a workflow ID (starts with wf_), find the most recent job
  if (workflowIdOrJobId.startsWith('wf_')) {
    console.log(`Finding most recent job for workflow: ${workflowIdOrJobId}`)
    const job = await findMostRecentJob(workflowIdOrJobId)
    
    if (!job) {
      console.error(`No jobs found for workflow ${workflowIdOrJobId}`)
      process.exit(1)
    }

    jobId = job.job_id
    tenantId = job.tenant_id
    console.log(`Found job: ${jobId}`)
    console.log(`Status: ${job.status}`)
    console.log(`Created: ${job.created_at}`)
  } else {
    // It's a job ID, get the job to find tenant_id
    try {
      const job = await docClient.send(new GetCommand({
        TableName: JOBS_TABLE,
        Key: { job_id: jobId },
      }))

      if (!job.Item) {
        console.error(`Job ${jobId} not found`)
        process.exit(1)
      }

      tenantId = job.Item.tenant_id
      console.log(`Job: ${jobId}`)
      console.log(`Status: ${job.Item.status}`)
    } catch (error) {
      console.error(`Error fetching job: ${error.message}`)
      process.exit(1)
    }
  }

  console.log(`\nRerunning step ${stepIndex} (step ${stepIndex + 1} in UI)...`)

  try {
    // Note: This requires authentication. You may need to get a token first.
    // For now, we'll try without auth - if it fails, you'll need to add auth headers
    const result = await rerunStep(jobId, stepIndex, tenantId)
    console.log(`✅ Step rerun initiated successfully!`)
    console.log(`   Message: ${result.message || 'Success'}`)
    console.log(`   Job ID: ${result.job_id || jobId}`)
    console.log(`   Step Index: ${result.step_index || stepIndex}`)
  } catch (error) {
    console.error(`❌ Error rerunning step: ${error.message}`)
    console.error(`\nNote: This script may require authentication.`)
    console.error(`You may need to:`)
    console.error(`1. Get an auth token from your browser`)
    console.error(`2. Add it to the script as an Authorization header`)
    console.error(`\nOr use the UI to rerun the step from the job detail page.`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

