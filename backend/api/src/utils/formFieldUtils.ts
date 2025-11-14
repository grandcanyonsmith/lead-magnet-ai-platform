/**
 * Form Field Utilities
 * Helper functions for managing form fields, including required field enforcement.
 */

export interface FormField {
  field_id: string;
  field_type: string;
  label: string;
  placeholder: string;
  required: boolean;
}

/**
 * Required fields that must always be present in forms.
 */
const REQUIRED_FIELDS: FormField[] = [
  { field_id: 'name', field_type: 'text' as const, label: 'Name', placeholder: 'Your name', required: true },
  { field_id: 'email', field_type: 'email' as const, label: 'Email', placeholder: 'your@email.com', required: true },
  { field_id: 'phone', field_type: 'tel' as const, label: 'Phone', placeholder: 'Your phone number', required: true },
];

/**
 * Ensures that required fields (name, email, phone) are present in the form fields schema.
 * Adds missing required fields at the beginning of the fields array.
 * 
 * @param fields - Array of existing form fields
 * @returns Array with required fields added if missing
 */
export function ensureRequiredFields(fields: FormField[]): FormField[] {
  const existingFieldIds = new Set(fields.map((f: any) => f.field_id));
  const fieldsToAdd = REQUIRED_FIELDS.filter(f => !existingFieldIds.has(f.field_id));
  
  // Add required fields at the beginning if they don't exist
  return fieldsToAdd.length > 0 
    ? [...fieldsToAdd, ...fields]
    : fields;
}

