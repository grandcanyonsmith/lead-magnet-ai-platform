"use strict";
/**
 * Form Field Utilities
 * Helper functions for managing form fields, including required field enforcement.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureRequiredFields = ensureRequiredFields;
const validators_1 = require("./validators");
const errors_1 = require("./errors");
/**
 * Required fields that must always be present in forms.
 */
const REQUIRED_FIELDS = [
    {
        field_id: 'name',
        field_type: 'text',
        label: 'Name',
        placeholder: 'Your name',
        required: true
    },
    {
        field_id: 'email',
        field_type: 'email',
        label: 'Email',
        placeholder: 'your@email.com',
        required: true
    },
    {
        field_id: 'phone',
        field_type: 'tel',
        label: 'Phone',
        placeholder: 'Your phone number',
        required: true
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
function ensureRequiredFields(fields) {
    if (!(0, validators_1.isArray)(fields)) {
        throw new errors_1.ValidationError('fields must be an array');
    }
    // Validate that all fields have required structure
    const validatedFields = fields.map((field, index) => {
        if (!(0, validators_1.isObject)(field)) {
            throw new errors_1.ValidationError(`Field at index ${index} must be an object`);
        }
        const f = field;
        if (!f.field_id || typeof f.field_id !== 'string') {
            throw new errors_1.ValidationError(`Field at index ${index} must have a valid field_id`);
        }
        return f;
    });
    const existingFieldIds = new Set(validatedFields.map(f => f.field_id));
    const fieldsToAdd = REQUIRED_FIELDS.filter(f => !existingFieldIds.has(f.field_id));
    // Add required fields at the beginning if they don't exist
    return fieldsToAdd.length > 0
        ? [...fieldsToAdd, ...validatedFields]
        : validatedFields;
}
//# sourceMappingURL=formFieldUtils.js.map