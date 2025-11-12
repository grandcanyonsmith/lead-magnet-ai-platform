import { z } from 'zod';

// Workflow step schema
export const workflowStepSchema = z.object({
  step_name: z.string().min(1).max(200),
  step_description: z.string().max(500).optional(),
  model: z.string().min(1),
  instructions: z.string().min(1),
  step_order: z.number().int().min(0).optional(),
  depends_on: z.array(z.number().int().min(0)).optional(), // Array of step indices this step depends on
  tools: z.array(
    z.union([
      z.string(), // Simple tool type string (e.g., "web_search_preview")
      z.object({
        type: z.string(),
        display_width: z.number().optional(),
        display_height: z.number().optional(),
        environment: z.enum(['browser', 'mac', 'windows', 'ubuntu']).optional(),
        // Allow other config fields for future tools
      }).passthrough(),
    ])
  ).optional(), // Array of tool types or tool objects with configuration
  tool_choice: z.enum(['auto', 'required', 'none']).optional().default('auto'), // How model should use tools
});

// Base workflow schema without refinement
const baseWorkflowSchema = z.object({
  workflow_name: z.string().min(1).max(200),
  workflow_description: z.string().max(1000).optional(),
  // New multi-step workflow support
  steps: z.array(workflowStepSchema).optional(),
  // Legacy fields (kept for backward compatibility)
  ai_model: z.string().default('gpt-5'),
  ai_instructions: z.string().min(1).optional(),
  rewrite_model: z.string().default('gpt-5'),
  rewrite_enabled: z.boolean().default(true),
  research_enabled: z.boolean().default(true),
  html_enabled: z.boolean().default(true),
  template_id: z.string().optional(),
  template_version: z.number().default(0),
  // Delivery configuration
  delivery_method: z.enum(['webhook', 'sms', 'none']).default('none'),
  delivery_webhook_url: z.string().url().optional(),
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
  // If steps array is provided, it must have at least one step
  if (data.steps !== undefined && data.steps.length === 0) {
    return false;
  }
  // If no steps array, legacy fields must be present
  if (!data.steps || data.steps.length === 0) {
    return !!(data.ai_instructions || data.research_enabled || data.html_enabled);
  }
  
  // Validate dependencies
  const depValidation = validateDependencies(data.steps);
  if (!depValidation.valid) {
    return false;
  }
  
  return true;
}, {
  message: 'Either provide steps array with at least one step, or use legacy fields (ai_instructions, research_enabled, html_enabled). Also ensure dependencies are valid and non-circular.',
});

export const updateWorkflowSchema = baseWorkflowSchema.partial().refine((data) => {
  // Only validate dependencies if steps are provided
  if (data.steps !== undefined && Array.isArray(data.steps) && data.steps.length > 0) {
    const depValidation = validateDependencies(data.steps);
    if (!depValidation.valid) {
      return false;
    }
  }
  return true;
}, {
  message: 'Dependencies must be valid and non-circular',
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
        field_type: z.enum(['text', 'textarea', 'email', 'tel', 'number', 'select', 'checkbox']),
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
  redirect_url: z.string().url().optional(),
});

export const updateFormSchema = createFormSchema.partial();

// Template schemas
export const createTemplateSchema = z.object({
  template_name: z.string().min(1).max(200),
  template_description: z.string().max(1000).optional(),
  html_content: z.string().min(1),
  placeholder_tags: z.array(z.string()).optional(),
  is_published: z.boolean().default(false),
});

export const updateTemplateSchema = createTemplateSchema.partial();

// Settings schema
export const updateSettingsSchema = z.object({
  organization_name: z.string().optional(),
  contact_email: z.string().email().optional(),
  website_url: z.string().url().optional(),
  logo_url: z.string().url().optional(),
  avatar_url: z.string().url().optional(),
  branding_colors: z
    .object({
      primary: z.string(),
      secondary: z.string(),
    })
    .optional(),
  default_ai_model: z.string().optional(),
  webhooks: z.array(z.string().url()).optional(),
  ghl_webhook_url: z.string().url().optional(),
  lead_phone_field: z.string().optional(),
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
export const submitFormSchema = z.object({
  submission_data: z.record(z.any()).refine(
    (data) => {
      // Ensure name, email, and phone are always present
      return data.name && data.email && data.phone;
    },
    {
      message: 'Form submission must include name, email, and phone fields',
    }
  ),
});

export const validate = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  return schema.parse(data);
};

