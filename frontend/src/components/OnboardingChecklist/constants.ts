/**
 * Checklist configuration constants
 */

import { ChecklistItem } from './types'

/**
 * Default checklist items configuration
 * These items guide users through the initial onboarding process
 */
export const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'complete_profile',
    label: 'Complete your profile/settings',
    route: '/dashboard/settings',
    tourId: 'settings',
    description: 'Set up your organization details and preferences',
  },
  {
    id: 'create_first_lead_magnet',
    label: 'Create your first lead magnet',
    route: '/dashboard/workflows/new',
    tourId: 'create-workflow',
    description: 'Build your first AI-powered lead magnet workflow',
  },
  {
    id: 'view_generated_lead_magnets',
    label: 'View generated lead magnets',
    route: '/dashboard/jobs',
    tourId: 'view-jobs',
    description: 'See all your generated lead magnets and their status',
  },
] as const

/**
 * Default checklist state - all items incomplete
 */
export const DEFAULT_CHECKLIST_STATE = {
  complete_profile: false,
  create_first_lead_magnet: false,
  view_generated_lead_magnets: false,
} as const

/**
 * Completion messages
 */
export const COMPLETION_MESSAGES = {
  ALL_COMPLETE: "🎉 All set! You're ready to create amazing lead magnets.",
  ITEM_COMPLETE: 'Great! You completed this step.',
} as const

/**
 * Widget configuration
 */
export const WIDGET_CONFIG = {
  /** Initial minimized state */
  INITIAL_MINIMIZED: true,
  /** Z-index for the widget */
  Z_INDEX: 50,
  /** Animation duration in ms */
  ANIMATION_DURATION: 300,
} as const

