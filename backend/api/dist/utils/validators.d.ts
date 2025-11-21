/**
 * Reusable validation functions for common validation patterns.
 * Provides consistent validation logic across utility modules.
 */
import { ValidationResult } from './types';
/**
 * Validates that a value is a non-empty string.
 *
 * @param value - Value to validate
 * @param fieldName - Name of the field for error messages
 * @throws {ValidationError} If value is not a non-empty string
 */
export declare function validateNonEmptyString(value: unknown, fieldName: string): asserts value is string;
/**
 * Validates that a value is a valid number within a range.
 *
 * @param value - Value to validate
 * @param fieldName - Name of the field for error messages
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @throws {ValidationError} If value is not a valid number in range
 */
export declare function validateNumberRange(value: unknown, fieldName: string, min: number, max: number): asserts value is number;
/**
 * Validates that a value is a valid URL.
 *
 * @param url - URL string to validate
 * @param fieldName - Name of the field for error messages
 * @throws {ValidationError} If value is not a valid URL
 */
export declare function validateUrl(url: unknown, fieldName?: string): asserts url is string;
/**
 * Validates that a value is a valid customer ID format.
 * Customer IDs should be non-empty strings, typically UUIDs or ULIDs.
 *
 * @param customerId - Customer ID to validate
 * @throws {ValidationError} If value is not a valid customer ID
 */
export declare function validateCustomerId(customerId: unknown): asserts customerId is string;
/**
 * Validates that a value is a valid user ID format.
 *
 * @param userId - User ID to validate
 * @throws {ValidationError} If value is not a valid user ID
 */
export declare function validateUserId(userId: unknown): asserts userId is string;
/**
 * Validates pagination parameters.
 *
 * @param limit - Limit value
 * @param offset - Offset value
 * @param maxLimit - Maximum allowed limit (default: 100)
 * @returns Normalized pagination parameters
 * @throws {ValidationError} If parameters are invalid
 */
export declare function validatePaginationParams(limit: unknown, offset: unknown, maxLimit?: number): {
    limit: number;
    offset: number;
};
/**
 * Validates a workflow step structure.
 *
 * @param step - Step object to validate
 * @param stepIndex - Index of the step in the workflow (for error messages)
 * @param totalSteps - Total number of steps (for dependency validation)
 * @returns Validation result
 */
export declare function validateWorkflowStep(step: unknown, stepIndex: number, totalSteps: number): ValidationResult;
/**
 * Validates an array of workflow steps.
 *
 * @param steps - Array of steps to validate
 * @returns Validation result
 */
export declare function validateWorkflowSteps(steps: unknown): ValidationResult;
/**
 * Type guard to check if a value is a valid object.
 *
 * @param value - Value to check
 * @returns True if value is a non-null object
 */
export declare function isObject(value: unknown): value is Record<string, unknown>;
/**
 * Type guard to check if a value is a valid array.
 *
 * @param value - Value to check
 * @returns True if value is an array
 */
export declare function isArray(value: unknown): value is unknown[];
/**
 * Type guard to check if a value is a valid string.
 *
 * @param value - Value to check
 * @returns True if value is a string
 */
export declare function isString(value: unknown): value is string;
/**
 * Type guard to check if a value is a valid number.
 *
 * @param value - Value to check
 * @returns True if value is a number and not NaN
 */
export declare function isNumber(value: unknown): value is number;
//# sourceMappingURL=validators.d.ts.map