/**
 * Draft Workflow Service
 * Handles saving AI-generated workflows (always saved as active)
 */

import { ulid } from 'ulid';
import { db } from '@utils/db';
import { logger } from '@utils/logger';
import { env } from '@utils/env';
import { FormService } from '@domains/forms/services/formService';
import { ensureStepDefaults, WorkflowStep } from './workflow/workflowConfigSupport';
import { createWorkflowVersion } from './workflowVersionService';

const WORKFLOWS_TABLE = env.workflowsTable;
const formService = new FormService();

export interface DraftWorkflowData {
  workflow_name: string;
  workflow_description?: string;
  steps: WorkflowStep[];
  form_fields_schema?: {
    fields: any[];
  };
}

/**
 * Save a generated workflow (always saved as active)
 */
export async function saveDraftWorkflow(
  tenantId: string,
  draftData: DraftWorkflowData,
  defaultToolChoice?: "auto" | "required" | "none",
  defaultServiceTier?: string,
  defaultTextVerbosity?: string
): Promise<{ workflow_id: string; form_id: string | null }> {
  if (!WORKFLOWS_TABLE) {
    throw new Error('WORKFLOWS_TABLE environment variable is not configured');
  }

  logger.info('[Draft Workflow Service] Saving AI-generated workflow as active', {
    tenantId,
    workflowName: draftData.workflow_name,
    stepsCount: draftData.steps?.length || 0,
  });

  // Ensure step_order is set for each step
  const workflowData = {
    ...draftData,
    steps: ensureStepDefaults(draftData.steps || [], {
      defaultToolChoice,
      defaultServiceTier,
      defaultTextVerbosity,
    }) as WorkflowStep[],
  };

  const workflowId = `wf_${ulid()}`;
  const workflow = {
    workflow_id: workflowId,
    tenant_id: tenantId,
    workflow_name: workflowData.workflow_name,
    workflow_description: workflowData.workflow_description || '',
    steps: workflowData.steps,
    version: 1,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await db.put(WORKFLOWS_TABLE, workflow);
  await createWorkflowVersion(workflow, 1);
  logger.info('[Draft Workflow Service] AI-generated workflow saved as active', { workflowId });

  // Auto-create form for the workflow if form fields are provided
  let formId: string | null = null;
  if (workflowData.form_fields_schema?.fields && workflowData.form_fields_schema.fields.length > 0) {
    try {
      formId = await formService.createFormForWorkflow(
        tenantId,
        workflowId,
        workflowData.workflow_name,
        workflowData.form_fields_schema.fields
      );
      
      // Update workflow with form_id
      await db.update(WORKFLOWS_TABLE, { workflow_id: workflowId }, {
        form_id: formId,
      });
      
      logger.info('[Draft Workflow Service] Form created and linked', {
        workflowId,
        formId,
      });
    } catch (error: any) {
      logger.error('[Draft Workflow Service] Error creating form', {
        workflowId,
        error: error.message,
      });
      // Continue even if form creation fails
    }
  }

  return {
    workflow_id: workflowId,
    form_id: formId,
  };
}

