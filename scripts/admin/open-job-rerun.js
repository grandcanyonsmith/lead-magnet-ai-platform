#!/usr/bin/env node

/**
 * Script to open job detail page for rerunning a step
 * Usage: node scripts/admin/open-job-rerun.js <workflow-id> [step-index]
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb')
const { exec } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)
require('dotenv').config()

const JOBS_TABLE = process.env.JOBS_TABLE || 'leadmagnet-jobs'
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://lead-magnet-ai-platform-frontend.vercel.app'

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
const docClient = DynamoDBDocumentClient.from(dynamoClient)

async function findMostRecentJob(workflowId) {
  try {
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

async function openUrl(url) {
  const platform = process.platform
  let command
  
  if (platform === 'darwin') {
    command = `open "${url}"`
  } else if (platform === 'win32') {
    command = `start "${url}"`
  } else {
    command = `xdg-open "${url}"`
  }
  
  try {
    await execAsync(command)
    console.log(`✅ Opened: ${url}`)
  } catch (error) {
    console.log(`⚠️  Could not auto-open browser. Please visit: ${url}`)
  }
}

async function main() {
  const workflowId = process.argv[2] || 'wf_01KAJXM6FVF93HKCS62VDQCHCW'
  const stepIndex = parseInt(process.argv[3] || '11', 10)

  console.log(`Finding most recent job for workflow: ${workflowId}`)
  const job = await findMostRecentJob(workflowId)
  
  if (!job) {
    console.error(`No jobs found for workflow ${workflowId}`)
    process.exit(1)
  }

  console.log(`\n📋 Job Details:`)
  console.log(`   Job ID: ${job.job_id}`)
  console.log(`   Status: ${job.status}`)
  console.log(`   Created: ${job.created_at}`)
  console.log(`\n🔗 Opening job detail page...`)
  console.log(`   Step ${stepIndex + 1} (index ${stepIndex}) can be rerun from the UI`)

  const url = `${FRONTEND_URL}/dashboard/jobs/${job.job_id}`
  await openUrl(url)

  console.log(`\n✅ Job page opened!`)
  console.log(`   To rerun step ${stepIndex + 1}:`)
  console.log(`   1. Scroll to step ${stepIndex + 1} in the job detail page`)
  console.log(`   2. Click the "Rerun Step" button`)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

