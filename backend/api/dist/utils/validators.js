"use strict";
/**
 * Reusable validation functions for common validation patterns.
 * Provides consistent validation logic across utility modules.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateNonEmptyString = validateNonEmptyString;
exports.validateNumberRange = validateNumberRange;
exports.validateUrl = validateUrl;
exports.validateCustomerId = validateCustomerId;
exports.validateUserId = validateUserId;
exports.validatePaginationParams = validatePaginationParams;
exports.validateWorkflowStep = validateWorkflowStep;
exports.validateWorkflowSteps = validateWorkflowSteps;
exports.isObject = isObject;
exports.isArray = isArray;
exports.isString = isString;
exports.isNumber = isNumber;
const errors_1 = require("./errors");
/**
 * Validates that a value is a non-empty string.
 *
 * @param value - Value to validate
 * @param fieldName - Name of the field for error messages
 * @throws {ValidationError} If value is not a non-empty string
 */
function validateNonEmptyString(value, fieldName) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new errors_1.ValidationError(`${fieldName} must be a non-empty string`);
    }
}
/**
 * Validates that a value is a valid number within a range.
 *
 * @param value - Value to validate
 * @param fieldName - Name of the field for error messages
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @throws {ValidationError} If value is not a valid number in range
 */
function validateNumberRange(value, fieldName, min, max) {
    if (typeof value !== 'number' || isNaN(value) || value < min || value > max) {
        throw new errors_1.ValidationError(`${fieldName} must be a number between ${min} and ${max}`);
    }
}
/**
 * Validates that a value is a valid URL.
 *
 * @param url - URL string to validate
 * @param fieldName - Name of the field for error messages
 * @throws {ValidationError} If value is not a valid URL
 */
function validateUrl(url, fieldName = 'URL') {
    if (typeof url !== 'string' || url.trim().length === 0) {
        throw new errors_1.ValidationError(`${fieldName} must be a non-empty string`);
    }
    try {
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            throw new errors_1.ValidationError(`${fieldName} must use HTTP or HTTPS protocol`);
        }
    }
    catch (error) {
        if (error instanceof errors_1.ValidationError) {
            throw error;
        }
        throw new errors_1.ValidationError(`${fieldName} is not a valid URL: ${url}`);
    }
}
/**
 * Validates that a value is a valid customer ID format.
 * Customer IDs should be non-empty strings, typically UUIDs or ULIDs.
 *
 * @param customerId - Customer ID to validate
 * @throws {ValidationError} If value is not a valid customer ID
 */
function validateCustomerId(customerId) {
    validateNonEmptyString(customerId, 'customerId');
    // Basic format validation - can be enhanced based on actual ID format
    if (customerId.length < 1 || customerId.length > 255) {
        throw new errors_1.ValidationError('customerId must be between 1 and 255 characters');
    }
}
/**
 * Validates that a value is a valid user ID format.
 *
 * @param userId - User ID to validate
 * @throws {ValidationError} If value is not a valid user ID
 */
function validateUserId(userId) {
    validateNonEmptyString(userId, 'userId');
    if (userId.length < 1 || userId.length > 255) {
        throw new errors_1.ValidationError('userId must be between 1 and 255 characters');
    }
}
/**
 * Validates pagination parameters.
 *
 * @param limit - Limit value
 * @param offset - Offset value
 * @param maxLimit - Maximum allowed limit (default: 100)
 * @returns Normalized pagination parameters
 * @throws {ValidationError} If parameters are invalid
 */
function validatePaginationParams(limit, offset, maxLimit = 100) {
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) :
        typeof limit === 'number' ? limit : 20;
    const offsetNum = typeof offset === 'string' ? parseInt(offset, 10) :
        typeof offset === 'number' ? offset : 0;
    if (isNaN(limitNum) || limitNum < 1) {
        throw new errors_1.ValidationError(`limit must be a positive number, got: ${limit}`);
    }
    if (limitNum > maxLimit) {
        throw new errors_1.ValidationError(`limit cannot exceed ${maxLimit}, got: ${limitNum}`);
    }
    if (isNaN(offsetNum) || offsetNum < 0) {
        throw new errors_1.ValidationError(`offset must be a non-negative number, got: ${offset}`);
    }
    return {
        limit: Math.min(limitNum, maxLimit),
        offset: Math.max(0, offsetNum),
    };
}
/**
 * Validates a workflow step structure.
 *
 * @param step - Step object to validate
 * @param stepIndex - Index of the step in the workflow (for error messages)
 * @param totalSteps - Total number of steps (for dependency validation)
 * @returns Validation result
 */
function validateWorkflowStep(step, stepIndex, totalSteps) {
    const errors = [];
    if (!step || typeof step !== 'object') {
        return {
            valid: false,
            errors: [`Step ${stepIndex}: must be an object`],
        };
    }
    const s = step;
    // Required fields
    if (!s.step_name || typeof s.step_name !== 'string' || s.step_name.trim().length === 0) {
        errors.push(`Step ${stepIndex}: step_name is required and must be a non-empty string`);
    }
    if (s.step_type === 'webhook') {
        if (!s.webhook_url || typeof s.webhook_url !== 'string') {
            errors.push(`Step ${stepIndex}: webhook_url is required for webhook steps`);
        }
    }
    else {
        // AI generation step (default)
        if (!s.model || typeof s.model !== 'string' || s.model.trim().length === 0) {
            errors.push(`Step ${stepIndex}: model is required and must be a non-empty string`);
        }
        if (!s.instructions || typeof s.instructions !== 'string' || s.instructions.trim().length === 0) {
            errors.push(`Step ${stepIndex}: instructions is required and must be a non-empty string`);
        }
    }
    // Optional but validated fields
    if (s.step_order !== undefined) {
        if (typeof s.step_order !== 'number' || !Number.isInteger(s.step_order) || s.step_order < 0) {
            errors.push(`Step ${stepIndex}: step_order must be a non-negative integer`);
        }
    }
    if (s.depends_on !== undefined) {
        if (!Array.isArray(s.depends_on)) {
            errors.push(`Step ${stepIndex}: depends_on must be an array`);
        }
        else {
            s.depends_on.forEach((depIndex, depArrayIndex) => {
                if (typeof depIndex !== 'number' || !Number.isInteger(depIndex)) {
                    errors.push(`Step ${stepIndex}: depends_on[${depArrayIndex}] must be an integer`);
                }
                else if (depIndex < 0 || depIndex >= totalSteps) {
                    errors.push(`Step ${stepIndex}: depends_on[${depArrayIndex}] (${depIndex}) is out of range [0, ${totalSteps - 1}]`);
                }
                else if (depIndex === stepIndex) {
                    errors.push(`Step ${stepIndex}: cannot depend on itself`);
                }
            });
        }
    }
    if (s.tools !== undefined && !Array.isArray(s.tools)) {
        errors.push(`Step ${stepIndex}: tools must be an array`);
    }
    if (s.tool_choice !== undefined && !['auto', 'required', 'none'].includes(s.tool_choice)) {
        errors.push(`Step ${stepIndex}: tool_choice must be 'auto', 'required', or 'none'`);
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
/**
 * Validates an array of workflow steps.
 *
 * @param steps - Array of steps to validate
 * @returns Validation result
 */
function validateWorkflowSteps(steps) {
    const errors = [];
    if (!Array.isArray(steps)) {
        return {
            valid: false,
            errors: ['Steps must be an array'],
        };
    }
    if (steps.length === 0) {
        return {
            valid: false,
            errors: ['At least one step is required'],
        };
    }
    // Validate each step
    steps.forEach((step, index) => {
        const stepValidation = validateWorkflowStep(step, index, steps.length);
        if (!stepValidation.valid) {
            errors.push(...stepValidation.errors);
        }
    });
    // Check for circular dependencies (basic check - full check in dependencyResolver)
    const visited = new Set();
    const recStack = new Set();
    const stepsArray = steps;
    function hasCycle(nodeIndex) {
        if (recStack.has(nodeIndex)) {
            return true;
        }
        if (visited.has(nodeIndex)) {
            return false;
        }
        visited.add(nodeIndex);
        recStack.add(nodeIndex);
        const step = stepsArray[nodeIndex];
        const deps = step.depends_on || [];
        for (const depIndex of deps) {
            if (hasCycle(depIndex)) {
                return true;
            }
        }
        recStack.delete(nodeIndex);
        return false;
    }
    for (let i = 0; i < steps.length; i++) {
        if (!visited.has(i) && hasCycle(i)) {
            errors.push(`Circular dependency detected involving step ${i}`);
            break;
        }
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
/**
 * Type guard to check if a value is a valid object.
 *
 * @param value - Value to check
 * @returns True if value is a non-null object
 */
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/**
 * Type guard to check if a value is a valid array.
 *
 * @param value - Value to check
 * @returns True if value is an array
 */
function isArray(value) {
    return Array.isArray(value);
}
/**
 * Type guard to check if a value is a valid string.
 *
 * @param value - Value to check
 * @returns True if value is a string
 */
function isString(value) {
    return typeof value === 'string';
}
/**
 * Type guard to check if a value is a valid number.
 *
 * @param value - Value to check
 * @returns True if value is a number and not NaN
 */
function isNumber(value) {
    return typeof value === 'number' && !isNaN(value);
}
//# sourceMappingURL=validators.js.map