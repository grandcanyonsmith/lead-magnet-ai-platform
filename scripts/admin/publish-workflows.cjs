#!/usr/bin/env node

/**
 * Script to publish workflows and create forms for them
 * Usage: node scripts/admin/publish-workflows.js <workflow-id-1> [workflow-id-2] ...
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')
require('dotenv').config()

const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || 'leadmagnet-workflows'
const FORMS_TABLE = process.env.FORMS_TABLE || 'leadmagnet-forms'

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
const docClient = DynamoDBDocumentClient.from(dynamoClient)

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .substring(0, 50)
}

function ensureRequiredFields(fields) {
  const requiredFields = ['name', 'email', 'phone']
  const existingFieldIds = new Set(fields.map(f => f.field_id))
  
  const fieldsToAdd = []
  
  if (!existingFieldIds.has('name')) {
    fieldsToAdd.push({
      field_id: 'name',
      field_type: 'text',
      label: 'Name',
      placeholder: 'Enter your name',
      required: true,
      validation_regex: undefined,
      max_length: undefined,
      options: undefined,
    })
  }
  
  if (!existingFieldIds.has('email')) {
    fieldsToAdd.push({
      field_id: 'email',
      field_type: 'email',
      label: 'Email',
      placeholder: 'Enter your email',
      required: true,
      validation_regex: undefined,
      max_length: undefined,
      options: undefined,
    })
  }
  
  if (!existingFieldIds.has('phone')) {
    fieldsToAdd.push({
      field_id: 'phone',
      field_type: 'tel',
      label: 'Phone',
      placeholder: 'Enter your phone number',
      required: true,
      validation_regex: undefined,
      max_length: undefined,
      options: undefined,
    })
  }
  
  return [...fields, ...fieldsToAdd]
}

async function createFormForWorkflow(tenantId, workflowId, workflowName) {
  try {
    // Check if form already exists
    const existingForms = await docClient.send(new ScanCommand({
      TableName: FORMS_TABLE,
      FilterExpression: 'workflow_id = :workflow_id AND attribute_not_exists(deleted_at)',
      ExpressionAttributeValues: {
        ':workflow_id': workflowId,
      },
    }))

    if (existingForms.Items && existingForms.Items.length > 0) {
      const existingForm = existingForms.Items[0]
      console.log(`   Form already exists: ${existingForm.form_id} (${existingForm.public_slug})`)
      return existingForm.form_id
    }

    // Create new form
    const formId = `form_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const publicSlug = generateSlug(workflowName)
    
    const defaultFields = ensureRequiredFields([])
    
    const form = {
      form_id: formId,
      workflow_id: workflowId,
      tenant_id: tenantId,
      form_name: `Form for ${workflowName}`,
      public_slug: publicSlug,
      form_fields_schema: {
        fields: defaultFields,
      },
      rate_limit_enabled: true,
      rate_limit_per_hour: 10,
      captcha_enabled: false,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await docClient.send(new UpdateCommand({
      TableName: FORMS_TABLE,
      Key: { form_id: formId },
      ...form,
    }))

    console.log(`   ✅ Created form: ${formId} (slug: ${publicSlug})`)
    return formId
  } catch (error) {
    console.error(`   ❌ Error creating form:`, error.message)
    return null
  }
}

async function publishWorkflow(workflowId) {
  try {
    console.log(`\n📋 Processing workflow: ${workflowId}`)
    
    // Get the workflow
    const workflowResult = await docClient.send(new GetCommand({
      TableName: WORKFLOWS_TABLE,
      Key: { workflow_id: workflowId },
    }))

    if (!workflowResult.Item) {
      console.error(`   ❌ Workflow ${workflowId} not found`)
      return false
    }

    const workflow = workflowResult.Item
    
    if (workflow.deleted_at) {
      console.error(`   ❌ Workflow ${workflowId} is deleted`)
      return false
    }

    console.log(`   Name: ${workflow.workflow_name}`)
    console.log(`   Current status: ${workflow.status || 'draft'}`)

    // Update status to active
    await docClient.send(new UpdateCommand({
      TableName: WORKFLOWS_TABLE,
      Key: { workflow_id: workflowId },
      UpdateExpression: 'SET #status = :status, updated_at = :updated_at',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'active',
        ':updated_at': new Date().toISOString(),
      },
    }))

    console.log(`   ✅ Updated status to: active`)

    // Create form if it doesn't exist
    let formId = workflow.form_id
    if (!formId) {
      formId = await createFormForWorkflow(
        workflow.tenant_id,
        workflowId,
        workflow.workflow_name
      )
      
      // Update workflow with form_id
      if (formId) {
        await docClient.send(new UpdateCommand({
          TableName: WORKFLOWS_TABLE,
          Key: { workflow_id: workflowId },
          UpdateExpression: 'SET form_id = :form_id',
          ExpressionAttributeValues: {
            ':form_id': formId,
          },
        }))
      }
    } else {
      // Check if form exists and is active
      try {
        const formResult = await docClient.send(new GetCommand({
          TableName: FORMS_TABLE,
          Key: { form_id: formId },
        }))
        
        if (formResult.Item && !formResult.Item.deleted_at) {
          // Ensure form is active
          await docClient.send(new UpdateCommand({
            TableName: FORMS_TABLE,
            Key: { form_id: formId },
            UpdateExpression: 'SET #status = :status, updated_at = :updated_at',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':status': 'active',
              ':updated_at': new Date().toISOString(),
            },
          }))
          console.log(`   ✅ Form is active: ${formId}`)
        }
      } catch (error) {
        console.log(`   ⚠️  Form ${formId} not found, creating new one...`)
        formId = await createFormForWorkflow(
          workflow.tenant_id,
          workflowId,
          workflow.workflow_name
        )
        if (formId) {
          await docClient.send(new UpdateCommand({
            TableName: WORKFLOWS_TABLE,
            Key: { workflow_id: workflowId },
            UpdateExpression: 'SET form_id = :form_id',
            ExpressionAttributeValues: {
              ':form_id': formId,
            },
          }))
        }
      }
    }

    return true
  } catch (error) {
    console.error(`   ❌ Error publishing workflow:`, error.message)
    return false
  }
}

// Parse command line arguments
const workflowIds = process.argv.slice(2)

if (workflowIds.length === 0) {
  console.error('Usage: node scripts/admin/publish-workflows.js <workflow-id-1> [workflow-id-2] ...')
  console.error('Example: node scripts/admin/publish-workflows.js wf_01KAK2CFE46J5ZY6Z22VRG204H wf_01KAK1NDN2DPR4SVV6D8TSWX4Q')
  process.exit(1)
}

// Import ScanCommand for form checking
const { ScanCommand } = require('@aws-sdk/lib-dynamodb')

async function main() {
  console.log(`🚀 Publishing ${workflowIds.length} workflow(s)...`)
  console.log('='.repeat(80))

  let successCount = 0
  let failCount = 0

  for (const workflowId of workflowIds) {
    const success = await publishWorkflow(workflowId)
    if (success) {
      successCount++
    } else {
      failCount++
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log(`\n✅ Successfully published: ${successCount}`)
  if (failCount > 0) {
    console.log(`❌ Failed: ${failCount}`)
  }
  console.log('\nDone!')

  process.exit(failCount > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

