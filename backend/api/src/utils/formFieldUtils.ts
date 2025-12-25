/**
 * Form Field Utilities
 * Helper functions for managing form fields, including required field enforcement.
 */

import { FormField } from "./types";
import { isArray, isObject } from "./validators";
import { ValidationError } from "./errors";

/**
 * Required fields that must always be present in forms.
 */
const REQUIRED_FIELDS: FormField[] = [
  {
    field_id: "name",
    field_type: "text",
    label: "Name",
    placeholder: "Your name",
    required: true,
  },
  {
    field_id: "email",
    field_type: "email",
    label: "Email",
    placeholder: "your@email.com",
    required: true,
  },
  {
    field_id: "phone",
    field_type: "tel",
    label: "Phone",
    placeholder: "Your phone number",
    required: true,
  },
];

/**
 * Ensures that required fields (name, email, phone) are present in the form fields schema.
 * Adds missing required fields at the beginning of the fields array.
 *
 * @param fields - Array of existing form fields
 * @returns Array with required fields added if missing
 * @throws {ValidationError} If fields is not a valid array
 *
 * @example
 * ```typescript
 * const fields = [
 *   { field_id: 'company', field_type: 'text', label: 'Company', required: false }
 * ];
 * const fieldsWithRequired = ensureRequiredFields(fields);
 * // Returns: [name field, email field, phone field, company field]
 * ```
 */
export function ensureRequiredFields(fields: unknown[]): FormField[] {
  if (!isArray(fields)) {
    throw new ValidationError("fields must be an array");
  }

  // Validate that all fields have required structure
  const validatedFields: FormField[] = fields.map((field, index) => {
    if (!isObject(field)) {
      throw new ValidationError(`Field at index ${index} must be an object`);
    }

    const f = field as Partial<FormField>;
    if (!f.field_id || typeof f.field_id !== "string") {
      throw new ValidationError(
        `Field at index ${index} must have a valid field_id`,
      );
    }

    return f as FormField;
  });

  const existingFieldIds = new Set(validatedFields.map((f) => f.field_id));
  const fieldsToAdd = REQUIRED_FIELDS.filter(
    (f) => !existingFieldIds.has(f.field_id),
  );

  // Add required fields at the beginning if they don't exist
  return fieldsToAdd.length > 0
    ? [...fieldsToAdd, ...validatedFields]
    : validatedFields;
}
