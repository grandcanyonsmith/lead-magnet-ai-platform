#!/usr/bin/env node

/**
 * Script to update a specific workflow step
 * Usage: node scripts/admin/update-workflow-step.js <workflow-id> <step-index>
 * 
 * Example: node scripts/admin/update-workflow-step.js wf_01KAJXM6FVF93HKCS62VDQCHCW 11
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')
require('dotenv').config()

const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || 'leadmagnet-workflows'

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
const docClient = DynamoDBDocumentClient.from(dynamoClient)

async function updateWorkflowStep(workflowId, stepIndex, stepUpdates) {
  try {
    console.log(`Fetching workflow ${workflowId}...`)
    
    // Get the workflow
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
      console.error(`Step index ${stepIndex} is out of range. Workflow has ${steps.length} steps (0-${steps.length - 1})`)
      process.exit(1)
    }

    console.log(`Updating step ${stepIndex} (${steps[stepIndex].step_name || 'unnamed'})...`)

    // Update the step
    const updatedSteps = [...steps]
    updatedSteps[stepIndex] = {
      ...updatedSteps[stepIndex],
      ...stepUpdates,
    }

    // Update the workflow
    await docClient.send(new UpdateCommand({
      TableName: WORKFLOWS_TABLE,
      Key: { workflow_id: workflowId },
      UpdateExpression: 'SET steps = :steps, updated_at = :updated_at',
      ExpressionAttributeValues: {
        ':steps': updatedSteps,
        ':updated_at': new Date().toISOString(),
      },
    }))

    console.log(`✅ Successfully updated step ${stepIndex}`)
    console.log(`   Step name: ${updatedSteps[stepIndex].step_name}`)
    console.log(`   Step type: ${updatedSteps[stepIndex].step_type || 'ai_generation'}`)
    if (updatedSteps[stepIndex].webhook_url) {
      console.log(`   Webhook URL: ${updatedSteps[stepIndex].webhook_url}`)
    }

  } catch (error) {
    console.error('Error updating workflow step:', error)
    if (error.message) {
      console.error('Error message:', error.message)
    }
    process.exit(1)
  }
}

// Parse command line arguments
const workflowId = process.argv[2]
const stepIndexStr = process.argv[3]

if (!workflowId || !stepIndexStr) {
  console.error('Usage: node scripts/admin/update-workflow-step.js <workflow-id> <step-index>')
  console.error('Example: node scripts/admin/update-workflow-step.js wf_01KAJXM6FVF93HKCS62VDQCHCW 11')
  process.exit(1)
}

const stepIndex = parseInt(stepIndexStr, 10)
if (isNaN(stepIndex)) {
  console.error('Error: Step index must be a number')
  process.exit(1)
}

// For step 12 (index 11), configure as webhook with custom payload
if (workflowId === 'wf_01KAJXM6FVF93HKCS62VDQCHCW' && stepIndex === 11) {
  const customPayload = {
    context: "Rocko is a professional piano musician and performer. He specializes in contemporary piano music, blending classical technique with modern genres like jazz, pop, and electronic music. Rocko performs at venues, weddings, and corporate events, and also teaches piano lessons online and in-person. His target audience includes aspiring pianists looking to improve their skills, music enthusiasts who appreciate live piano performances, and event planners seeking unique musical entertainment. Rocko offers online courses for piano fundamentals, advanced techniques, and improvisation. He struggles with marketing his music online, finding consistent gig opportunities, and scaling his teaching business beyond one-on-one lessons. His dream is to build a thriving online piano education platform and perform at major music festivals.",
    subdomain: "rocko-piano",
    uid: "rocko-musician-001"
  }

  updateWorkflowStep(workflowId, stepIndex, {
    step_type: 'webhook',
    webhook_url: 'https://template-docs-grandcanyonsmit.replit.app/api/clients/generate',
    webhook_headers: {
      'Content-Type': 'application/json'
    },
    webhook_custom_payload: customPayload,
  })
    .then(() => {
      console.log('\nDone!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
} else {
  console.error('This script is configured for workflow wf_01KAJXM6FVF93HKCS62VDQCHCW step 11 (step 12 in UI)')
  console.error('To update a different workflow/step, modify the script or use the UI')
  process.exit(1)
}

