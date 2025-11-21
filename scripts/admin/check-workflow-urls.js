#!/usr/bin/env node

/**
 * Script to check and fix invalid URLs in a workflow
 * Usage: node scripts/admin/check-workflow-urls.js <workflow-id>
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')
require('dotenv').config()

const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || 'leadmagnet-workflows'

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
const docClient = DynamoDBDocumentClient.from(dynamoClient)

function isValidUrl(string) {
  if (!string || typeof string !== 'string') return false
  try {
    const url = new URL(string)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch (_) {
    return false
  }
}

function fixWorkflowUrls(workflow) {
  const steps = workflow.steps || []
  let hasChanges = false
  const fixedSteps = steps.map((step, index) => {
    const fixedStep = { ...step }
    
    // Check webhook_url
    if (step.webhook_url && !isValidUrl(step.webhook_url)) {
      console.log(`   Step ${index + 1} (${step.step_name}): Invalid webhook_url: "${step.webhook_url}"`)
      // Remove invalid webhook_url
      delete fixedStep.webhook_url
      hasChanges = true
    }
    
    // Check webhook_headers for URL values
    if (step.webhook_headers && typeof step.webhook_headers === 'object') {
      const fixedHeaders = { ...step.webhook_headers }
      let headersChanged = false
      
      for (const [key, value] of Object.entries(fixedHeaders)) {
        if (typeof value === 'string' && value.startsWith('http') && !isValidUrl(value)) {
          console.log(`   Step ${index + 1}: Invalid URL in header "${key}": "${value}"`)
          delete fixedHeaders[key]
          headersChanged = true
          hasChanges = true
        }
      }
      
      if (headersChanged) {
        fixedStep.webhook_headers = Object.keys(fixedHeaders).length > 0 ? fixedHeaders : undefined
      }
    }
    
    // Check delivery_webhook_url
    if (workflow.delivery_webhook_url && !isValidUrl(workflow.delivery_webhook_url)) {
      console.log(`   Workflow delivery_webhook_url is invalid: "${workflow.delivery_webhook_url}"`)
      hasChanges = true
    }
    
    return fixedStep
  })
  
  return { fixedSteps, hasChanges }
}

async function checkAndFixWorkflow(workflowId) {
  try {
    console.log(`Checking workflow: ${workflowId}\n`)
    
    const workflowResult = await docClient.send(new GetCommand({
      TableName: WORKFLOWS_TABLE,
      Key: { workflow_id: workflowId },
    }))

    if (!workflowResult.Item) {
      console.error(`Workflow ${workflowId} not found`)
      process.exit(1)
    }

    const workflow = workflowResult.Item
    console.log(`Workflow: ${workflow.workflow_name}`)
    console.log(`Steps: ${workflow.steps?.length || 0}\n`)
    
    const { fixedSteps, hasChanges } = fixWorkflowUrls(workflow)
    
    if (hasChanges) {
      console.log('\n⚠️  Found invalid URLs. Fixing...\n')
      
      const updateData = {
        steps: fixedSteps,
        updated_at: new Date().toISOString(),
      }
      
      // Remove invalid delivery_webhook_url if present
      if (workflow.delivery_webhook_url && !isValidUrl(workflow.delivery_webhook_url)) {
        updateData.delivery_webhook_url = undefined
      }
      
      await docClient.send(new UpdateCommand({
        TableName: WORKFLOWS_TABLE,
        Key: { workflow_id: workflowId },
        UpdateExpression: 'SET steps = :steps, updated_at = :updated_at' + 
          (updateData.delivery_webhook_url === undefined ? ', delivery_webhook_url = :null' : ''),
        ExpressionAttributeValues: {
          ':steps': updateData.steps,
          ':updated_at': updateData.updated_at,
          ...(updateData.delivery_webhook_url === undefined ? { ':null': null } : {}),
        },
      }))
      
      console.log('✅ Fixed invalid URLs')
    } else {
      console.log('✅ No invalid URLs found')
    }
    
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

const workflowId = process.argv[2] || 'wf_01KAJZT08R4FC8EG8DCM09700B'

checkAndFixWorkflow(workflowId)
  .then(() => {
    console.log('\n✅ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

