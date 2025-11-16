'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Joyride, { CallBackProps, STATUS, EVENTS, ACTIONS } from 'react-joyride'
import { getTourSteps, TourId } from '@/shared/lib/tours'

interface TourProviderProps {
  children: React.ReactNode
  activeTourId: TourId | null
  onTourComplete?: (tourId: TourId) => void
  onTourSkip?: (tourId: TourId) => void
}

export function TourProvider({ children, activeTourId, onTourComplete, onTourSkip }: TourProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [run, setRun] = useState(false)
  const [steps, setSteps] = useState<any[]>([])

  useEffect(() => {
    if (activeTourId) {
      const tourSteps = getTourSteps(activeTourId)
      setSteps(tourSteps)
      // Wait a bit for page to fully render before starting tour
      setTimeout(() => {
        setRun(true)
      }, 500)
    } else {
      setRun(false)
      setSteps([])
    }
  }, [activeTourId, pathname])

  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { status, type, action } = data

      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        setRun(false)
        if (activeTourId) {
          if (status === STATUS.FINISHED) {
            onTourComplete?.(activeTourId)
          } else if (status === STATUS.SKIPPED) {
            onTourSkip?.(activeTourId)
          }
        }
      }

      // Handle close button
      if (type === EVENTS.STEP_AFTER && action === ACTIONS.CLOSE) {
        setRun(false)
        if (activeTourId) {
          onTourSkip?.(activeTourId)
        }
      }
    },
    [activeTourId, onTourComplete, onTourSkip]
  )

  return (
    <>
      {children}
      {steps.length > 0 && (
        <Joyride
          steps={steps}
          run={run}
          continuous
          showProgress
          showSkipButton
          callback={handleJoyrideCallback}
          styles={{
            options: {
              primaryColor: '#6366f1', // primary-500
              zIndex: 10000,
            },
            tooltip: {
              borderRadius: '8px',
            },
            buttonNext: {
              backgroundColor: '#6366f1',
              borderRadius: '6px',
            },
            buttonBack: {
              color: '#6366f1',
            },
            buttonSkip: {
              color: '#6b7280',
            },
          }}
          locale={{
            back: 'Back',
            close: 'Close',
            last: 'Finish',
            next: 'Next',
            skip: 'Skip',
          }}
        />
      )}
    </>
  )
}

