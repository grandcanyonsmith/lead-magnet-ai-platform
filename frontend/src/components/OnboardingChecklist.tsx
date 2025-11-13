'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FiCheckCircle, FiCircle, FiX, FiList } from 'react-icons/fi'
import { api } from '@/lib/api'
import { TourId } from '@/lib/tours'

interface OnboardingChecklistProps {
  settings: {
    onboarding_checklist?: {
      complete_profile?: boolean
      create_first_lead_magnet?: boolean
      view_generated_lead_magnets?: boolean
    }
    onboarding_survey_completed?: boolean
  }
  onStartTour: (tourId: TourId) => void
}

interface ChecklistItem {
  id: keyof NonNullable<OnboardingChecklistProps['settings']['onboarding_checklist']>
  label: string
  route: string
  tourId: TourId
}

const checklistItems: ChecklistItem[] = [
  {
    id: 'complete_profile',
    label: 'Complete your profile/settings',
    route: '/dashboard/settings',
    tourId: 'settings',
  },
  {
    id: 'create_first_lead_magnet',
    label: 'Create your first lead magnet',
    route: '/dashboard/workflows/new',
    tourId: 'create-workflow',
  },
  {
    id: 'view_generated_lead_magnets',
    label: 'View generated lead magnets',
    route: '/dashboard/jobs',
    tourId: 'view-jobs',
  },
]

export function OnboardingChecklist({ settings, onStartTour }: OnboardingChecklistProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(() => {
    // Check localStorage for dismissed state
    if (typeof window !== 'undefined') {
      return localStorage.getItem('onboarding-checklist-dismissed') !== 'true'
    }
    return true
  })
  const [isMinimized, setIsMinimized] = useState(true) // Start minimized
  const [updating, setUpdating] = useState<string | null>(null)

  const checklist = settings.onboarding_checklist || {
    complete_profile: false,
    create_first_lead_magnet: false,
    view_generated_lead_magnets: false,
  }

  const allCompleted = Object.values(checklist).every((completed) => completed === true)

  // Don't show if survey not completed or all items completed
  if (!settings.onboarding_survey_completed || allCompleted) {
    return null
  }

  const handleItemClick = async (item: ChecklistItem) => {
    if (updating) return

    setUpdating(item.id)
    setIsMinimized(true)

    // Navigate to the page
    router.push(item.route)

    // Start the tour after navigation
    setTimeout(() => {
      onStartTour(item.tourId)
      setUpdating(null)
    }, 300)
  }

  const handleDismiss = () => {
    setIsOpen(false)
    // Persist dismissal in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboarding-checklist-dismissed', 'true')
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-50 bg-white rounded-lg shadow-xl border border-gray-200 transition-all duration-300 ${
        isMinimized ? 'w-auto sm:w-64' : 'w-full sm:w-80'
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-white">
        <div className="flex items-center">
          <FiList className="w-5 h-5 text-primary-600 mr-2" />
          <h3 className="font-semibold text-gray-900">Getting Started</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-gray-500 hover:text-gray-700 p-2 rounded hover:bg-gray-100 touch-target"
            aria-label={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
          <button
            onClick={handleDismiss}
            className="text-gray-500 hover:text-gray-700 p-2 rounded hover:bg-gray-100 touch-target"
            aria-label="Dismiss"
            title="Dismiss checklist"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            Complete these steps to get the most out of Lead Magnet AI:
          </p>
          <ul className="space-y-3">
            {checklistItems.map((item) => {
              const completed = checklist[item.id] || false
              const isUpdating = updating === item.id

              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleItemClick(item)}
                    disabled={completed || isUpdating}
                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                      completed
                        ? 'bg-green-50 text-green-700 cursor-default'
                        : isUpdating
                        ? 'bg-gray-50 text-gray-500 cursor-wait'
                        : 'bg-gray-50 hover:bg-primary-50 text-gray-700 hover:text-primary-700 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center flex-1 text-left">
                      {completed ? (
                        <FiCheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0" />
                      ) : (
                        <FiCircle className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    {!completed && !isUpdating && (
                      <svg
                        className="w-4 h-4 ml-2 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                    {isUpdating && (
                      <svg
                        className="animate-spin h-4 w-4 ml-2 text-primary-600"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
          {allCompleted && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-green-700 font-medium text-center">
                🎉 All set! You&apos;re ready to create amazing lead magnets.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

