/**
 * Form validation utilities
 */

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validateRequired(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0
  }
  return value !== null && value !== undefined
}

export function validateMinLength(value: string, minLength: number): boolean {
  return value.length >= minLength
}

export function validateMaxLength(value: string, maxLength: number): boolean {
  return value.length <= maxLength
}

export function validateSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9-]+$/
  return slugRegex.test(slug)
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export function validateFormField(
  value: unknown,
  rules: {
    required?: boolean
    minLength?: number
    maxLength?: number
    email?: boolean
    slug?: boolean
  }
): ValidationResult {
  const errors: string[] = []

  if (rules.required && !validateRequired(value)) {
    errors.push('This field is required')
  }

  if (typeof value === 'string') {
    if (rules.minLength && !validateMinLength(value, rules.minLength)) {
      errors.push(`Must be at least ${rules.minLength} characters`)
    }

    if (rules.maxLength && !validateMaxLength(value, rules.maxLength)) {
      errors.push(`Must be no more than ${rules.maxLength} characters`)
    }

    if (rules.email && !validateEmail(value)) {
      errors.push('Must be a valid email address')
    }

    if (rules.slug && !validateSlug(value)) {
      errors.push('Must contain only lowercase letters, numbers, and hyphens')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

