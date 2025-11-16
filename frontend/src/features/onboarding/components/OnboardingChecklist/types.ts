/**
 * Type definitions for OnboardingChecklist component
 */

import { TourId } from '@/shared/lib/tours'
import { OnboardingChecklist as OnboardingChecklistType } from '@/features/settings/types'

/**
 * Checklist item ID - must match keys in OnboardingChecklist type
 */
export type ChecklistItemId = keyof NonNullable<OnboardingChecklistType>

/**
 * Checklist item configuration
 */
export interface ChecklistItem {
  /** Unique identifier matching OnboardingChecklist key */
  id: ChecklistItemId
  /** Display label for the checklist item */
  label: string
  /** Route to navigate to when item is clicked */
  route: string
  /** Tour ID to start after navigation */
  tourId: TourId
  /** Optional description/tooltip for the item */
  description?: string
}

/**
 * Settings prop structure for OnboardingChecklist
 */
export interface OnboardingChecklistSettings {
  /** Whether the onboarding survey has been completed */
  onboarding_survey_completed?: boolean
  /** Checklist completion status */
  onboarding_checklist?: OnboardingChecklistType
}

/**
 * Props for OnboardingChecklist component
 */
export interface OnboardingChecklistProps {
  /** User settings containing onboarding state */
  settings: OnboardingChecklistSettings
  /** Callback to start a tour when checklist item is clicked */
  onStartTour: (tourId: TourId) => void
  /** Optional callback when checklist is dismissed */
  onDismiss?: () => void
  /** Optional callback when checklist item is clicked */
  onItemClick?: (itemId: ChecklistItemId) => void
}

/**
 * Internal state for checklist item operations
 */
export interface ChecklistItemState {
  /** ID of the item currently being processed */
  updating: ChecklistItemId | null
  /** Error message for the current operation */
  error: string | null
  /** Whether the operation is retrying */
  retrying: boolean
}

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  DISMISSED: 'onboarding-checklist-dismissed',
  MINIMIZED: 'onboarding-checklist-minimized',
} as const

/**
 * Navigation configuration
 */
export const NAVIGATION_CONFIG = {
  /** Maximum number of navigation retry attempts */
  MAX_RETRIES: 3,
  /** Initial delay before starting tour (ms) */
  INITIAL_TOUR_DELAY: 500,
  /** Maximum delay before timing out (ms) */
  MAX_TOUR_DELAY: 5000,
  /** Interval to check for navigation completion (ms) */
  NAVIGATION_CHECK_INTERVAL: 100,
} as const

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  NAVIGATION_FAILED: 'Failed to navigate. Please try again.',
  TOUR_START_FAILED: 'Failed to start tour. Please try again.',
  GENERIC: 'An error occurred. Please try again.',
} as const

