import { Step } from 'react-joyride'

export type TourId = 'settings' | 'create-workflow' | 'view-jobs'

export interface TourConfig {
  id: TourId
  steps: Step[]
}

export const tourConfigs: Record<TourId, TourConfig> = {
  settings: {
    id: 'settings',
    steps: [
      {
        target: '[data-tour="settings-form"]',
        content: 'Complete your profile by filling in your organization details. This helps personalize your lead magnets.',
        placement: 'top',
        disableBeacon: true,
      },
      {
        target: '[data-tour="organization-name"]',
        content: 'Enter your business or organization name here.',
        placement: 'top',
      },
      {
        target: '[data-tour="contact-email"]',
        content: 'Add your contact email for lead notifications.',
        placement: 'top',
      },
      {
        target: '[data-tour="save-settings"]',
        content: 'Click Save Settings when you\'re done. This will mark your profile as complete!',
        placement: 'top',
      },
    ],
  },
  'create-workflow': {
    id: 'create-workflow',
    steps: [
      {
        target: '[data-tour="workflow-form"]',
        content: 'Welcome! Let\'s create your first AI-powered lead magnet. This form will guide you through the process.',
        placement: 'bottom',
        disableBeacon: true,
      },
      {
        target: '[data-tour="workflow-name"]',
        content: 'Give your lead magnet a descriptive name. This helps you identify it later.',
        placement: 'top',
      },
      {
        target: '[data-tour="workflow-description"]',
        content: 'Describe what your lead magnet will do. Be specific about the value it provides to your leads.',
        placement: 'top',
      },
      {
        target: '[data-tour="workflow-steps"]',
        content: 'Define the steps your AI will follow to create the lead magnet. Each step can use different AI models and tools.',
        placement: 'top',
      },
      {
        target: '[data-tour="create-workflow-button"]',
        content: 'Once you\'ve filled in the details, click here to create your lead magnet workflow!',
        placement: 'top',
      },
    ],
  },
  'view-jobs': {
    id: 'view-jobs',
    steps: [
      {
        target: '[data-tour="jobs-list"]',
        content: 'This is where all your generated lead magnets appear. Each one represents a completed AI generation job.',
        placement: 'bottom',
        disableBeacon: true,
      },
      {
        target: '[data-tour="job-status"]',
        content: 'Check the status of each job - completed, pending, or failed. Click on any job to see details.',
        placement: 'top',
      },
      {
        target: '[data-tour="job-filters"]',
        content: 'Use filters to find specific lead magnets by status, date, or workflow.',
        placement: 'top',
      },
      {
        target: '[data-tour="view-artifacts"]',
        content: 'Once a job is completed, you can download the generated lead magnet from the Artifacts section.',
        placement: 'top',
      },
    ],
  },
}

export const getTourSteps = (tourId: TourId): Step[] => {
  return tourConfigs[tourId]?.steps || []
}

