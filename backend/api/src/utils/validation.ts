import { z } from 'zod';
import { ValidationError } from './errors';

// Workflow step schema
export const workflowStepSchema = z.object({
  step_name: z.string().min(1).max(200),
  step_description: z.string().max(500).optional(),
  step_type: z.enum(['ai_generation', 'webhook']).optional().default('ai_generation'),
  model: z.string().min(1).optional(), // Optional for webhook steps
  instructions: z.string().min(1).optional(), // Optional for webhook steps
  step_order: z.number().int().min(0).optional(),
  depends_on: z.array(z.number().int().min(0)).optional(), // Array of step indices this step depends on
  tools: z.array(
    z.union([
      z.string(), // Simple tool type string (e.g., "web_search")
      z.object({
        type: z.string(),
        display_width: z.number().optional(),
        display_height: z.number().optional(),
        environment: z.enum(['browser', 'mac', 'windows', 'ubuntu']).optional(),
        // Image generation tool specific fields
        size: z.union([
          z.enum(['1024x1024', '1024x1536', '1536x1024', 'auto']),
          z.string()
        ]).optional(),
        quality: z.enum(['low', 'medium', 'high', 'auto']).optional(),
        format: z.enum(['png', 'jpeg', 'webp']).optional(),
        compression: z.number().int().min(0).max(100).optional(),
        background: z.union([
          z.enum(['transparent', 'opaque', 'auto']),
          z.string()
        ]).optional(),
        input_fidelity: z.enum(['low', 'high']).optional(),
        // Allow other config fields for future tools
      }).passthrough(),
    ])
  ).optional(), // Array of tool types or tool objects with configuration
  tool_choice: z.enum(['auto', 'required', 'none']).optional().default('auto'), // How model should use tools
  // Webhook step fields
  webhook_url: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().url().optional()
  ),
  webhook_headers: z.record(z.string()).optional(),
  webhook_data_selection: z.object({
    include_submission: z.boolean().optional().default(true),
    exclude_step_indices: z.array(z.number().int().min(0)).optional(),
    include_job_info: z.boolean().optional().default(true),
  }).optional(),
}).refine((data) => {
  // If step_type is 'webhook', webhook_url is required
  if (data.step_type === 'webhook') {
    return !!data.webhook_url;
  }
  // If step_type is 'ai_generation' (default), model and instructions are required
  if (data.step_type === 'ai_generation' || !data.step_type) {
    return !!(data.model && data.instructions);
  }
  return true;
}, {
  message: 'Webhook steps require webhook_url. AI generation steps require model and instructions.',
});

// Base workflow schema without refinement
const baseWorkflowSchema = z.object({
  workflow_name: z.string().min(1).max(200),
  workflow_description: z.string().max(1000).optional(),
  // New multi-step workflow support
  steps: z.array(workflowStepSchema).optional(),
  // Status field for workflow lifecycle
  status: z.enum(['draft', 'active', 'inactive']).optional(),
  // Folder organization
  folder_id: z.string().nullable().optional(),
  // Legacy fields (kept for backward compatibility in database, but not used for new workflows)
  ai_model: z.string().optional(),
  ai_instructions: z.string().optional(),
  rewrite_model: z.string().optional(),
  research_enabled: z.boolean().optional(),
  html_enabled: z.boolean().optional(),
  template_id: z.string().optional(),
  template_version: z.number().default(0),
  // Delivery configuration
  delivery_method: z.enum(['webhook', 'sms', 'none']).default('none'),
  delivery_webhook_url: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().url().optional()
  ),
  delivery_webhook_headers: z.record(z.string()).optional(),
  delivery_sms_enabled: z.boolean().default(false),
  delivery_sms_message: z.string().optional(), // Manual SMS message
  delivery_sms_ai_generated: z.boolean().default(false), // If true, AI will generate SMS
  delivery_sms_ai_instructions: z.string().optional(), // Instructions for AI SMS generation
});

// Helper function to validate dependencies
function validateDependencies(steps: any[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!steps || steps.length === 0) {
    return { valid: true, errors: [] };
  }
  
  steps.forEach((step, index) => {
    if (step.depends_on && Array.isArray(step.depends_on)) {
      // Check that all dependency indices are valid
      step.depends_on.forEach((depIndex: number) => {
        if (depIndex < 0 || depIndex >= steps.length) {
          errors.push(`Step ${index} (${step.step_name}): depends_on index ${depIndex} is out of range`);
        }
        if (depIndex === index) {
          errors.push(`Step ${index} (${step.step_name}): cannot depend on itself`);
        }
      });
    }
  });
  
  // Check for circular dependencies using DFS
  const visited = new Set<number>();
  const recStack = new Set<number>();
  
  function hasCycle(nodeIndex: number): boolean {
    if (recStack.has(nodeIndex)) {
      return true; // Found a cycle
    }
    if (visited.has(nodeIndex)) {
      return false; // Already processed
    }
    
    visited.add(nodeIndex);
    recStack.add(nodeIndex);
    
    const step = steps[nodeIndex];
    if (step.depends_on && Array.isArray(step.depends_on)) {
      for (const depIndex of step.depends_on) {
        if (hasCycle(depIndex)) {
          return true;
        }
      }
    }
    
    recStack.delete(nodeIndex);
    return false;
  }
  
  for (let i = 0; i < steps.length; i++) {
    if (!visited.has(i) && hasCycle(i)) {
      errors.push(`Circular dependency detected involving step ${i} (${steps[i].step_name})`);
      break;
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// Workflow schemas with refinement
export const createWorkflowSchema = baseWorkflowSchema.refine((data) => {
  // Steps array is required and must have at least one step
  if (!data.steps || data.steps.length === 0) {
    return false;
  }
  
  // Validate dependencies
  const depValidation = validateDependencies(data.steps);
  if (!depValidation.valid) {
    return false;
  }
  
  return true;
}, {
  message: 'Workflow must have at least one step. Legacy format is no longer supported. Also ensure dependencies are valid and non-circular.',
});

export const updateWorkflowSchema = baseWorkflowSchema.partial().refine((data) => {
  // Only validate dependencies if steps are provided
  if (data.steps !== undefined && Array.isArray(data.steps) && data.steps.length > 0) {
    const depValidation = validateDependencies(data.steps);
    if (!depValidation.valid) {
      // Store error details in the data object for better error reporting
      (data as any).__validationErrors = depValidation.errors;
      return false;
    }
  }
  return true;
}, (data) => {
  // Provide more detailed error message if available
  const errors = (data as any).__validationErrors;
  if (errors && Array.isArray(errors) && errors.length > 0) {
    return {
      message: `Dependency validation failed: ${errors.join('; ')}`,
    };
  }
  return {
    message: 'Dependencies must be valid and non-circular',
  };
});

// Form schemas
export const createFormSchema = z.object({
  workflow_id: z.string(),
  form_name: z.string().min(1).max(200),
  public_slug: z.string().regex(/^[a-z0-9-]+$/),
  form_fields_schema: z.object({
    fields: z.array(
      z.object({
        field_id: z.string(),
        field_type: z.enum(['text', 'textarea', 'email', 'tel', 'number', 'select', 'checkbox', 'radio']),
        label: z.string(),
        placeholder: z.string().optional(),
        required: z.boolean(),
        validation_regex: z.string().optional(),
        max_length: z.number().optional(),
        options: z.array(z.string()).optional(),
      })
    ),
  }),
  rate_limit_enabled: z.boolean().default(true),
  rate_limit_per_hour: z.number().default(10),
  captcha_enabled: z.boolean().default(false),
  custom_css: z.string().optional(),
  thank_you_message: z.string().optional(),
  redirect_url: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().url().optional()
  ),
});

export const updateFormSchema = createFormSchema.partial();

// Template schemas
export const createTemplateSchema = z.object({
  template_name: z.string().min(1).max(200),
  template_description: z.string().max(1000).optional(),
  html_content: z.string().min(1),
  placeholder_tags: z.array(z.string()).optional(),
  is_published: z.boolean().default(true), // Templates are published by default
});

export const updateTemplateSchema = createTemplateSchema.partial();

// Settings schema
export const updateSettingsSchema = z.object({
  organization_name: z.string().optional(),
  contact_email: z.string().email().optional(),
  website_url: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().url().optional()
  ),
  logo_url: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().url().optional()
  ),
  avatar_url: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().url().optional()
  ),
  branding_colors: z
    .object({
      primary: z.string(),
      secondary: z.string(),
    })
    .optional(),
  default_ai_model: z.string().optional(),
  custom_domain: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return undefined;
      const strVal = String(val).trim();
      try {
        const url = new URL(strVal.includes('://') ? strVal : `https://${strVal}`);
        return url.origin;
      } catch {
        return strVal;
      }
    },
    z.string().url().optional()
  ),
  webhooks: z.array(z.string().url()).optional(),
  ghl_webhook_url: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().url().optional()
  ),
  lead_phone_field: z.string().optional(),
  // Brand information fields
  brand_description: z.string().optional(),
  brand_voice: z.string().optional(),
  target_audience: z.string().optional(),
  company_values: z.string().optional(),
  industry: z.string().optional(),
  company_size: z.string().optional(),
  brand_messaging_guidelines: z.string().optional(),
  icp_document_url: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().url().optional()
  ),
  // Onboarding fields
  onboarding_survey_completed: z.boolean().optional(),
  onboarding_survey_responses: z.record(z.any()).optional(),
  onboarding_checklist: z.object({
    complete_profile: z.boolean().optional(),
    create_first_lead_magnet: z.boolean().optional(),
    view_generated_lead_magnets: z.boolean().optional(),
  }).optional(),
  onboarding_completed_at: z.string().optional(),
});

// Form submission schema
const hasPhoneValue = (data: Record<string, any>) => {
  // Prefer explicit phone/phone_number/mobile fields
  const explicitPhoneFields = ['phone', 'phone_number', 'phoneNumber', 'mobile', 'mobile_phone', 'contact_phone'];
  for (const field of explicitPhoneFields) {
    if (data[field]) return true;
  }
  
  // Fallback: any field containing "phone" or "mobile"
  return Object.keys(data).some((key) => {
    const lower = key.toLowerCase();
    return (lower.includes('phone') || lower.includes('mobile')) && !!data[key];
  });
};

export const submitFormSchema = z.object({
  submission_data: z.record(z.any()).refine(
    (data) => {
      // Ensure name, email, and at least one phone-like field are present
      return !!data.name && !!data.email && hasPhoneValue(data);
    },
    {
      message: 'Form submission must include name, email, and a phone number',
    }
  ),
});

// Webhook request schema
export const webhookRequestSchema = z.object({
  workflow_id: z.string().optional(),
  workflow_name: z.string().optional(),
  form_data: z.record(z.any()).optional(),
  submission_data: z.record(z.any()).optional(),
}).refine(
  (data) => {
    // At least one of workflow_id or workflow_name must be provided
    return !!(data.workflow_id || data.workflow_name);
  },
  {
    message: 'Either workflow_id or workflow_name is required',
  }
);

/**
 * Validate data against a Zod schema.
 * 
 * Parses and validates data using a Zod schema, throwing a ValidationError
 * if validation fails. This provides consistent error handling across the application.
 * 
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validated and typed data
 * @throws {ValidationError} If validation fails
 * 
 * @example
 * ```typescript
 * try {
 *   const workflow = validate(createWorkflowSchema, requestBody);
 *   // workflow is now typed and validated
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     // Handle validation error
 *   }
 * }
 * ```
 */
export const validate = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Validation failed', {
        errors: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
      });
    }
    throw error;
  }
};

/**
 * Safe validation that returns errors instead of throwing
 */
export const safeValidate = <T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError['errors'] } => {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.errors };
};

