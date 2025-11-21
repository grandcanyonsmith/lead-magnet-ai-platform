#!/usr/bin/env node

/**
 * Script to check a specific workflow step
 * Usage: node scripts/admin/check-workflow-step.js <workflow-id> <step-index>
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb')
require('dotenv').config()

const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || 'leadmagnet-workflows'

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
const docClient = DynamoDBDocumentClient.from(dynamoClient)

async function checkWorkflowStep(workflowId, stepIndex) {
  try {
    console.log(`Fetching workflow ${workflowId}...`)
    
    const workflowResult = await docClient.send(new GetCommand({
      TableName: WORKFLOWS_TABLE,
      Key: { workflow_id: workflowId },
    }))

    if (!workflowResult.Item) {
      console.error(`Workflow ${workflowId} not found`)
      process.exit(1)
    }

    const workflow = workflowResult.Item
    const steps = workflow.steps || []

    if (stepIndex < 0 || stepIndex >= steps.length) {
      console.error(`Step index ${stepIndex} is out of range. Workflow has ${steps.length} steps`)
      process.exit(1)
    }

    const step = steps[stepIndex]
    
    console.log(`\n📋 Step ${stepIndex + 1} (index ${stepIndex}):`)
    console.log(`   Name: ${step.step_name || 'unnamed'}`)
    console.log(`   Type: ${step.step_type || 'ai_generation'}`)
    
    if (step.step_type === 'webhook') {
      console.log(`   Webhook URL: ${step.webhook_url || 'NOT SET'}`)
      if (step.webhook_headers) {
        console.log(`   Headers:`, JSON.stringify(step.webhook_headers, null, 2))
      }
      if (step.webhook_custom_payload) {
        console.log(`   Custom Payload:`, JSON.stringify(step.webhook_custom_payload, null, 2))
      }
      if (step.webhook_data_selection) {
        console.log(`   Data Selection:`, JSON.stringify(step.webhook_data_selection, null, 2))
      }
    } else {
      console.log(`   Model: ${step.model || 'not set'}`)
      console.log(`   Instructions: ${step.instructions ? step.instructions.substring(0, 100) + '...' : 'not set'}`)
    }
    
    console.log(`   Dependencies: ${step.depends_on ? step.depends_on.join(', ') : 'none'}`)
    
  } catch (error) {
    console.error('Error checking workflow step:', error)
    if (error.message) {
      console.error('Error message:', error.message)
    }
    process.exit(1)
  }
}

const workflowId = process.argv[2] || 'wf_01KAJXM6FVF93HKCS62VDQCHCW'
const stepIndexStr = process.argv[3] || '11'

const stepIndex = parseInt(stepIndexStr, 10)
if (isNaN(stepIndex)) {
  console.error('Error: Step index must be a number')
  process.exit(1)
}

checkWorkflowStep(workflowId, stepIndex)
  .then(() => {
    console.log('\n✅ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

