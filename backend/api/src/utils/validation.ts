import { z } from 'zod';

// Workflow schemas
export const createWorkflowSchema = z.object({
  workflow_name: z.string().min(1).max(200),
  workflow_description: z.string().max(1000).optional(),
  ai_model: z.string().default('gpt-5'),
  ai_instructions: z.string().min(1),
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

export const updateWorkflowSchema = createWorkflowSchema.partial();

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

