#!/usr/bin/env node

/**
 * Script to list recent workflows
 * Usage: node scripts/admin/list-recent-workflows.js [limit]
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb')
require('dotenv').config()

const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || 'leadmagnet-workflows'

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
const docClient = DynamoDBDocumentClient.from(dynamoClient)

async function listRecentWorkflows(limit = 10) {
  try {
    console.log(`Fetching recent workflows (limit: ${limit})...\n`)
    
    // Scan all workflows
    const result = await docClient.send(new ScanCommand({
      TableName: WORKFLOWS_TABLE,
      FilterExpression: 'attribute_not_exists(deleted_at)',
    }))

    if (!result.Items || result.Items.length === 0) {
      console.log('No workflows found')
      return
    }

    // Sort by updated_at (most recent first)
    const workflows = result.Items
      .filter(w => !w.deleted_at)
      .sort((a, b) => {
        const aTime = new Date(a.updated_at || a.created_at || 0).getTime()
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime()
        return bTime - aTime
      })
      .slice(0, limit)

    console.log(`Found ${workflows.length} recent workflows:\n`)
    console.log('='.repeat(100))
    
    workflows.forEach((workflow, index) => {
      const steps = workflow.steps || []
      const created = workflow.created_at ? new Date(workflow.created_at).toLocaleString() : 'Unknown'
      const updated = workflow.updated_at ? new Date(workflow.updated_at).toLocaleString() : 'Unknown'
      
      console.log(`\n${index + 1}. ${workflow.workflow_name || 'Unnamed Workflow'}`)
      console.log(`   ID: ${workflow.workflow_id}`)
      console.log(`   Steps: ${steps.length}`)
      console.log(`   Created: ${created}`)
      console.log(`   Updated: ${updated}`)
      
      if (workflow.workflow_description) {
        console.log(`   Description: ${workflow.workflow_description.substring(0, 100)}${workflow.workflow_description.length > 100 ? '...' : ''}`)
      }
      
      // Show step types
      if (steps.length > 0) {
        const stepTypes = steps.map(s => s.step_type || 'ai_generation')
        const webhookSteps = stepTypes.filter(t => t === 'webhook').length
        const aiSteps = stepTypes.filter(t => t === 'ai_generation' || !t).length
        
        console.log(`   Step Types: ${aiSteps} AI generation, ${webhookSteps} webhook`)
        
        // Show first few step names
        const stepNames = steps.slice(0, 3).map(s => s.step_name || 'Unnamed').join(', ')
        if (steps.length > 3) {
          console.log(`   First Steps: ${stepNames}... (+${steps.length - 3} more)`)
        } else {
          console.log(`   Steps: ${stepNames}`)
        }
      }
      
      console.log(`   Status: ${workflow.status || 'active'}`)
    })
    
    console.log('\n' + '='.repeat(100))
    console.log(`\nTotal workflows in database: ${result.Items.length}`)
    
  } catch (error) {
    console.error('Error listing workflows:', error)
    if (error.message) {
      console.error('Error message:', error.message)
    }
    process.exit(1)
  }
}

const limit = parseInt(process.argv[2] || '10', 10)

listRecentWorkflows(limit)
  .then(() => {
    console.log('\n✅ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

