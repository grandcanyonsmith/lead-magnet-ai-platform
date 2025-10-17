import { z } from 'zod';

// Workflow schemas
export const createWorkflowSchema = z.object({
  workflow_name: z.string().min(1).max(200),
  workflow_description: z.string().max(1000).optional(),
  ai_model: z.string().default('gpt-4o'),
  ai_instructions: z.string().min(1),
  rewrite_model: z.string().default('gpt-4o'),
  rewrite_enabled: z.boolean().default(true),
  template_id: z.string(),
  template_version: z.number().default(0),
  delivery_webhook_url: z.string().url().optional(),
  delivery_phone: z.string().optional(),
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
  avatar_url: z.string().url().optional(),
  branding_colors: z
    .object({
      primary: z.string(),
      secondary: z.string(),
    })
    .optional(),
  default_ai_model: z.string().optional(),
  webhooks: z.array(z.string().url()).optional(),
});

// Form submission schema
export const submitFormSchema = z.object({
  submission_data: z.record(z.any()),
});

export const validate = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  return schema.parse(data);
};

