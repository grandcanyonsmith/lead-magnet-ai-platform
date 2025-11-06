#!/usr/bin/env node
/**
 * Migration script to auto-create forms for existing workflows without forms
 * 
 * This script:
 * 1. Finds all workflows that don't have forms
 * 2. Creates a form for each workflow with name "{workflow_name} Form"
 * 3. Generates appropriate public_slug
 * 4. Links forms to workflows
 * 
 * Usage:
 *   AWS_REGION=us-east-1 WORKFLOWS_TABLE=leadmagnet-workflows FORMS_TABLE=leadmagnet-forms node scripts/migrate-workflows-to-forms.js
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { ulid } = require('ulid');

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || 'leadmagnet-workflows';
const FORMS_TABLE = process.env.FORMS_TABLE || 'leadmagnet-forms';

const client = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

function generateSlug(name) {
  return name.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function ensureRequiredFields(fields) {
  const requiredFields = [
    { field_id: 'name', field_type: 'text', label: 'Name', placeholder: 'Your name', required: true },
    { field_id: 'email', field_type: 'email', label: 'Email', placeholder: 'your@email.com', required: true },
    { field_id: 'phone', field_type: 'tel', label: 'Phone', placeholder: 'Your phone number', required: true },
  ];

  const existingFieldIds = new Set(fields.map(f => f.field_id));
  const fieldsToAdd = requiredFields.filter(f => !existingFieldIds.has(f.field_id));
  
  return fieldsToAdd.length > 0 ? [...fieldsToAdd, ...fields] : fields;
}

async function createFormForWorkflow(workflow) {
  const workflowId = workflow.workflow_id;
  const tenantId = workflow.tenant_id;
  const workflowName = workflow.workflow_name || 'Lead Magnet';

  // Check if workflow already has a form
  const formsQuery = await docClient.send(new QueryCommand({
    TableName: FORMS_TABLE,
    IndexName: 'gsi_workflow_id',
    KeyConditionExpression: 'workflow_id = :workflow_id',
    ExpressionAttributeValues: {
      ':workflow_id': workflowId,
    },
  }));

  const activeForm = formsQuery.Items?.find(f => !f.deleted_at);
  if (activeForm) {
    return { skipped: true, formId: activeForm.form_id };
  }

  // Generate form name and slug
  const formName = `${workflowName} Form`;
  let baseSlug = generateSlug(workflowName);
  let publicSlug = baseSlug;
  let slugCounter = 1;

  // Ensure slug is unique
  while (true) {
    const slugQuery = await docClient.send(new QueryCommand({
      TableName: FORMS_TABLE,
      IndexName: 'gsi_public_slug',
      KeyConditionExpression: 'public_slug = :slug',
      ExpressionAttributeValues: {
        ':slug': publicSlug,
      },
    }));

    if (!slugQuery.Items || slugQuery.Items.length === 0 || slugQuery.Items[0].deleted_at) {
      break;
    }

    publicSlug = `${baseSlug}-${slugCounter}`;
    slugCounter++;
  }

  // Default form fields
  const defaultFields = [
    { field_id: 'name', field_type: 'text', label: 'Name', placeholder: 'Your name', required: true },
    { field_id: 'email', field_type: 'email', label: 'Email', placeholder: 'your@email.com', required: true },
    { field_id: 'phone', field_type: 'tel', label: 'Phone', placeholder: 'Your phone number', required: true },
  ];

  const formFieldsWithRequired = ensureRequiredFields(defaultFields);

  const formId = `form_${ulid()}`;
  const form = {
    form_id: formId,
    tenant_id: tenantId,
    workflow_id: workflowId,
    form_name: formName,
    public_slug: publicSlug,
    form_fields_schema: {
      fields: formFieldsWithRequired,
    },
    rate_limit_enabled: true,
    rate_limit_per_hour: 10,
    captcha_enabled: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: FORMS_TABLE,
    Item: form,
  }));

  // Update workflow with form_id
  await docClient.send(new UpdateCommand({
    TableName: WORKFLOWS_TABLE,
    Key: { workflow_id: workflowId },
    UpdateExpression: 'SET form_id = :form_id',
    ExpressionAttributeValues: {
      ':form_id': formId,
    },
  }));

  return { created: true, formId };
}

async function main() {
  console.log('Starting migration: Creating forms for workflows without forms...\n');

  try {
    console.log('Scanning workflows table...');
    
    let lastEvaluatedKey = undefined;
    let allWorkflows = [];
    
    do {
      const scanResult = await docClient.send(new ScanCommand({
        TableName: WORKFLOWS_TABLE,
        ExclusiveStartKey: lastEvaluatedKey,
      }));
      
      if (scanResult.Items) {
        allWorkflows = allWorkflows.concat(scanResult.Items);
      }
      
      lastEvaluatedKey = scanResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    // Filter out deleted workflows
    const activeWorkflows = allWorkflows.filter(w => !w.deleted_at);
    
    console.log(`Found ${activeWorkflows.length} active workflows\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const workflow of activeWorkflows) {
      try {
        const result = await createFormForWorkflow(workflow);
        
        if (result.skipped) {
          console.log(`⏭  Skipping workflow ${workflow.workflow_id} - already has form ${result.formId}`);
          skipped++;
        } else {
          console.log(`✓ Created form ${result.formId} for workflow ${workflow.workflow_id} (${workflow.workflow_name || 'Unnamed'})`);
          created++;
        }
      } catch (error) {
        console.error(`  ✗ Error processing workflow ${workflow.workflow_id}:`, error.message);
        errors++;
      }
    }

    console.log(`\nMigration complete!`);
    console.log(`  Created: ${created} forms`);
    console.log(`  Skipped: ${skipped} workflows (already have forms)`);
    console.log(`  Errors: ${errors}`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

