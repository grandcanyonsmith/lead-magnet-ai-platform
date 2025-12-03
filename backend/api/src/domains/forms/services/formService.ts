import { ulid } from 'ulid';
import { db } from '@utils/db';
import { ApiError } from '@utils/errors';
import { logger } from '@utils/logger';
import { env } from '@utils/env';

const FORMS_TABLE = env.formsTable;

if (!FORMS_TABLE) {
  logger.error('[FormService] FORMS_TABLE environment variable is not set');
}

/**
 * Generate a URL-friendly slug from a workflow name
 */
export function generateSlug(name: string): string {
  return name.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Ensure name, email, and phone fields are always present in form fields
 */
export function ensureRequiredFields(fields: any[]): any[] {
  const requiredFields = [
    { field_id: 'name', field_type: 'text' as const, label: 'Name', placeholder: 'Your name', required: true },
    { field_id: 'email', field_type: 'email' as const, label: 'Email', placeholder: 'your@email.com', required: true },
    { field_id: 'phone', field_type: 'tel' as const, label: 'Phone', placeholder: 'Your phone number', required: true },
  ];

  const existingFieldIds = new Set(fields.map((f: any) => f.field_id));
  const fieldsToAdd = requiredFields.filter(f => !existingFieldIds.has(f.field_id));
  
  return fieldsToAdd.length > 0 ? [...fieldsToAdd, ...fields] : fields;
}

export class FormService {
  /**
   * Create a form for a workflow
   */
  async createFormForWorkflow(
    tenantId: string,
    workflowId: string,
    workflowName: string,
    formFields?: any[]
  ): Promise<string> {
    if (!FORMS_TABLE) {
      throw new ApiError('FORMS_TABLE environment variable is not configured', 500);
    }

    // Check if workflow already has a form
    const existingFormsResult = await db.query(
      FORMS_TABLE,
      'gsi_workflow_id',
      'workflow_id = :workflow_id',
      { ':workflow_id': workflowId }
    );
    const existingForms = Array.isArray(existingFormsResult) ? existingFormsResult : existingFormsResult.items;

    if (existingForms.length > 0 && !existingForms[0].deleted_at) {
      // Workflow already has a form, return existing form_id
      return existingForms[0].form_id;
    }

    // Generate form name and slug
    const formName = `${workflowName} Form`;
    let baseSlug = generateSlug(workflowName);
    let publicSlug = baseSlug;
    let slugCounter = 1;

    // Ensure slug is unique
    while (true) {
      const slugCheckResult = await db.query(
        FORMS_TABLE!,
        'gsi_public_slug',
        'public_slug = :slug',
        { ':slug': publicSlug }
      );
      const slugCheck = Array.isArray(slugCheckResult) ? slugCheckResult : slugCheckResult.items;
    
      if (slugCheck.length === 0 || slugCheck[0].deleted_at) {
        break;
      }
    
      publicSlug = `${baseSlug}-${slugCounter}`;
      slugCounter++;
    }

    // Default form fields if not provided
    const defaultFields = formFields || [
      { field_id: 'name', field_type: 'text', label: 'Name', placeholder: 'Your name', required: true },
      { field_id: 'email', field_type: 'email', label: 'Email', placeholder: 'your@email.com', required: true },
      { field_id: 'phone', field_type: 'tel', label: 'Phone', placeholder: 'Your phone number', required: true },
    ];

    const formFieldsWithRequired = ensureRequiredFields(defaultFields);

    const form = {
      form_id: `form_${ulid()}`,
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

    await db.put(FORMS_TABLE!, form);

    return form.form_id;
  }

  /**
   * Get the active form for a workflow
   */
  async getFormForWorkflow(workflowId: string): Promise<any | null> {
    if (!FORMS_TABLE) {
      throw new ApiError('FORMS_TABLE environment variable is not configured', 500);
    }

    try {
      const formsResult = await db.query(
        FORMS_TABLE!,
        'gsi_workflow_id',
        'workflow_id = :workflow_id',
        { ':workflow_id': workflowId }
      );
      const forms = Array.isArray(formsResult) ? formsResult : formsResult.items;
      
      const activeForm = forms.find((f: any) => !f.deleted_at);
      return activeForm || null;
    } catch (error) {
      logger.error('[FormService] Error fetching form for workflow', {
        workflowId,
        error: (error as any).message,
      });
      return null;
    }
  }

  /**
   * Update form name when workflow name changes
   */
  async updateFormName(workflowId: string, newWorkflowName: string): Promise<void> {
    if (!FORMS_TABLE) {
      throw new ApiError('FORMS_TABLE environment variable is not configured', 500);
    }

    try {
      const formsResult = await db.query(
        FORMS_TABLE!,
        'gsi_workflow_id',
        'workflow_id = :workflow_id',
        { ':workflow_id': workflowId }
      );
      const forms = Array.isArray(formsResult) ? formsResult : formsResult.items;
      
      const activeForm = forms.find((f: any) => !f.deleted_at);
      if (activeForm) {
        const newFormName = `${newWorkflowName} Form`;
        await db.update(FORMS_TABLE!, { form_id: activeForm.form_id }, {
          form_name: newFormName,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error('[FormService] Error updating form name', {
        workflowId,
        error: (error as any).message,
      });
      throw error;
    }
  }

  /**
   * Soft delete all forms associated with a workflow
   */
  async deleteFormsForWorkflow(workflowId: string): Promise<void> {
    if (!FORMS_TABLE) {
      throw new ApiError('FORMS_TABLE environment variable is not configured', 500);
    }

    try {
      const formsResult = await db.query(
        FORMS_TABLE!,
        'gsi_workflow_id',
        'workflow_id = :workflow_id',
        { ':workflow_id': workflowId }
      );
      const forms = Array.isArray(formsResult) ? formsResult : formsResult.items;
      
      for (const form of forms) {
        if (!form.deleted_at) {
          await db.update(FORMS_TABLE!, { form_id: form.form_id }, {
            deleted_at: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      logger.error('[FormService] Error deleting forms for workflow', {
        workflowId,
        error: (error as any).message,
      });
      throw error;
    }
  }
}

export const formService = new FormService();

