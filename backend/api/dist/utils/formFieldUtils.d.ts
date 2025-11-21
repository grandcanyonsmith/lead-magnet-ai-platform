/**
 * Form Field Utilities
 * Helper functions for managing form fields, including required field enforcement.
 */
import { FormField } from './types';
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
export declare function ensureRequiredFields(fields: unknown[]): FormField[];
//# sourceMappingURL=formFieldUtils.d.ts.map