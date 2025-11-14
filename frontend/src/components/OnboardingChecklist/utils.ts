/**
 * Utility functions for OnboardingChecklist component
 */

import { OnboardingChecklist as OnboardingChecklistType } from '@/types/settings'
import { DEFAULT_CHECKLIST_STATE } from './constants'

/**
 * Calculate completion percentage for the checklist
 */
export function calculateProgress(
  checklist: OnboardingChecklistType | undefined
): number {
  const items = checklist || DEFAULT_CHECKLIST_STATE
  const total = Object.keys(DEFAULT_CHECKLIST_STATE).length
  const completed = Object.values(items).filter(Boolean).length
  return Math.round((completed / total) * 100)
}

/**
 * Check if all checklist items are completed
 */
export function areAllItemsCompleted(
  checklist: OnboardingChecklistType | undefined
): boolean {
  const items = checklist || DEFAULT_CHECKLIST_STATE
  return Object.values(items).every((completed) => completed === true)
}

/**
 * Get default checklist state
 */
export function getDefaultChecklist(): OnboardingChecklistType {
  return { ...DEFAULT_CHECKLIST_STATE }
}

/**
 * Safe localStorage getter
 */
export function getLocalStorageItem(key: string): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return localStorage.getItem(key)
  } catch (error) {
    console.error(`Failed to get localStorage item "${key}":`, error)
    return null
  }
}

/**
 * Safe localStorage setter
 */
export function setLocalStorageItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    console.error(`Failed to set localStorage item "${key}":`, error)
    return false
  }
}

/**
 * Safe localStorage remover
 */
export function removeLocalStorageItem(key: string): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  try {
    localStorage.removeItem(key)
    return true
  } catch (error) {
    console.error(`Failed to remove localStorage item "${key}":`, error)
    return false
  }
}

/**
 * Exponential backoff delay calculator
 */
export function calculateBackoffDelay(attempt: number, baseDelay: number = 1000): number {
  return Math.min(baseDelay * Math.pow(2, attempt), 10000) // Max 10 seconds
}

/**
 * Wait for a condition to be true with timeout
 */
export async function waitForCondition(
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<boolean> {
  const startTime = Date.now()
  
  return new Promise((resolve) => {
    const checkCondition = () => {
      if (condition()) {
        resolve(true)
        return
      }
      
      if (Date.now() - startTime >= timeout) {
        resolve(false)
        return
      }
      
      setTimeout(checkCondition, interval)
    }
    
    checkCondition()
  })
}

